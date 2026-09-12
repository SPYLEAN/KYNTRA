"""KYNTRA OpenF1 Live Telemetry Provider.

Connects to the OpenF1 real-time timing & telemetry platform using backend authentication.
Supports MQTT live pub/sub streaming with resilient REST synchronization fallback.
Normalizes incoming multi-channel records into the canonical KYNTRA domain model (RaceState)
with strict provenance attribution (source_mode="LIVE_FEED").

Channels consumed:
- sessions / meetings (session identity, circuit, total laps)
- drivers (driver numbers, codes, team, colors)
- car_data (speed, rpm, gear, throttle, brake, drs)
- location (2D track coordinates)
- position (official running order)
- intervals (gaps to leader and interval ahead)
- laps (lap numbers, sector durations)
- race_control (track status, safety car, yellow/red flags)
- weather (track temperature, rainfall, weather status)
"""

import logging
import os
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
import requests

from kyntra.ingestion.capture import SessionCaptureWriter
from kyntra.ingestion.discovery import discover_openf1_session
from kyntra.providers.base import BaseDataProvider, ProviderCapabilities, ProviderMetadata
from kyntra.schemas import CarState, RaceState, SessionState, TrackState

logger = logging.getLogger(__name__)


class OpenF1LiveProvider(BaseDataProvider):
    """Production-style OpenF1 live provider implementing the BaseDataProvider interface."""

    def __init__(
        self,
        session_key: Optional[Union[int, str]] = None,
        meeting_key: Optional[Union[int, str]] = None,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        mqtt_broker: Optional[str] = None,
        mqtt_port: Optional[int] = None,
        capture_writer: Optional[SessionCaptureWriter] = None,
        event_query: str = "Spain",
        year: int = 2026,
        enable_network: bool = False,
    ):
        self.base_url = base_url or os.getenv("OPENF1_BASE_URL", "https://api.openf1.org/v1")
        self.token = token or os.getenv("OPENF1_TOKEN")
        self.username = username or os.getenv("OPENF1_USERNAME")
        self.password = password or os.getenv("OPENF1_PASSWORD")
        self.mqtt_broker = mqtt_broker or os.getenv("OPENF1_MQTT_BROKER", "mqtt.openf1.org")
        self.mqtt_port = int(mqtt_port or os.getenv("OPENF1_MQTT_PORT", 8883))
        self.capture_writer = capture_writer
        self.enable_network = enable_network

        self.session_key = session_key or os.getenv("OPENF1_SESSION_KEY")
        self.meeting_key = meeting_key or os.getenv("OPENF1_MEETING_KEY")
        self.event_query = event_query
        self.year = year

        # Session metadata
        self.event_name: str = "Spanish Grand Prix"
        self.circuit_name: str = "Circuito de Madring, Madrid"
        self.session_type: str = "PRACTICE"
        self.event_id: str = "2026_14_ESP"
        self.total_laps: int = 53

        # Normalization internal state
        self._lock = threading.Lock()
        self._drivers: Dict[str, Dict[str, Any]] = {}       # driver_number -> metadata
        self._positions: Dict[str, int] = {}                # driver_number -> position
        self._intervals: Dict[str, Dict[str, Any]] = {}     # driver_number -> intervals
        self._car_data: Dict[str, Dict[str, Any]] = {}      # driver_number -> telemetry
        self._locations: Dict[str, Dict[str, Any]] = {}     # driver_number -> x, y
        self._laps: Dict[str, Dict[str, Any]] = {}          # driver_number -> lap data
        self._stints: Dict[str, Dict[str, Any]] = {}        # driver_number -> stint data
        self._track_status: str = "1"
        self._active_flags: List[str] = ["GREEN"]
        self._weather: str = "DRY"
        self._current_lap: int = 1
        self._session_time: float = 0.0
        self._last_update_ts: float = time.time()
        self._last_data_receive_ts: float = time.time()

        # Transport & Workers
        self._is_running: bool = False
        self._is_paused: bool = False
        self._mqtt_client: Any = None
        self._polling_thread: Optional[threading.Thread] = None

    def start(self) -> None:
        """Initialize session metadata and establish live ingestion streams."""
        with self._lock:
            self._is_running = True
            self._is_paused = False

            # 1. Discover session if not statically assigned
            if not self.session_key:
                try:
                    disc = discover_openf1_session(
                        query=self.event_query,
                        year=self.year,
                        base_url=self.base_url,
                        timeout=1.0,
                    )
                    self.session_key = disc.get("session_key")
                    self.meeting_key = disc.get("meeting_key")
                    self.event_name = disc.get("meeting_name", self.event_name)
                    self.circuit_name = disc.get("circuit", self.circuit_name)
                    self.session_type = disc.get("session_type", self.session_type)
                    self.total_laps = disc.get("total_laps", self.total_laps)
                except Exception as e:
                    logger.warning(f"Session discovery fallback applied: {e}")

            # 2. If network enabled, connect REST and MQTT
            if self.enable_network:
                # Fetch driver roster via REST
                self._fetch_drivers_roster()

                # Connect MQTT if paho-mqtt is available and broker configured
                self._connect_mqtt()

                # Start background sync poller as reliable transport/fallback
                self._polling_thread = threading.Thread(target=self._poll_loop, daemon=True)
                self._polling_thread.start()


    def stop(self) -> None:
        """Terminate all connections and background workers."""
        with self._lock:
            self._is_running = False
            if self._mqtt_client:
                try:
                    self._mqtt_client.loop_stop()
                    self._mqtt_client.disconnect()
                except Exception:
                    pass
                self._mqtt_client = None

            if self.capture_writer:
                try:
                    self.capture_writer.close()
                except Exception:
                    pass

    def pause(self) -> None:
        """Live feeds do not pause server reception; sets flag for client consumption."""
        self._is_paused = True

    def resume(self) -> None:
        self._is_paused = False

    def seek(self, lap: int) -> bool:
        """Seeking is unsupported on live synchronous broadcast streams."""
        return False

    def set_speed(self, speed: float) -> None:
        """Playback speed is fixed to 1.0x real-time on live streams."""
        pass

    def ingest_records(self, channel: str, records: List[Dict[str, Any]]) -> None:
        """Normalize and integrate a batch of records from a specific OpenF1 channel.
        
        Usable both by live transport (MQTT / REST) and test fixtures.
        """
        with self._lock:
            self._last_data_receive_ts = time.time()
            if channel == "drivers":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        self._drivers[num] = {
                            "code": r.get("name_acronym") or f"#{num}",
                            "name": r.get("broadcast_name") or r.get("full_name") or f"Driver {num}",
                            "team": r.get("team_name") or "Independent",
                            "color": f"#{r.get('team_colour')}" if r.get("team_colour") else "#94a3b8",
                        }

            elif channel == "position":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    pos = r.get("position")
                    if num and pos is not None:
                        try:
                            self._positions[num] = int(pos)
                        except (ValueError, TypeError):
                            pass

            elif channel == "intervals":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        self._intervals[num] = {
                            "gap_to_leader": r.get("gap_to_leader"),
                            "interval": r.get("interval"),
                        }

            elif channel == "car_data":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        self._car_data[num] = {
                            "speed": r.get("speed"),
                            "rpm": r.get("rpm"),
                            "gear": r.get("n_gear"),
                            "throttle": r.get("throttle"),
                            "brake": r.get("brake"),
                            "drs": bool(r.get("drs") in [10, 12, 14, True]),
                        }

            elif channel == "location":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        self._locations[num] = {
                            "x": r.get("x"),
                            "y": r.get("y"),
                        }

            elif channel == "laps":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        lap_num = r.get("lap_number")
                        if lap_num is not None:
                            self._laps[num] = {
                                "lap_number": int(lap_num),
                                "lap_duration": r.get("lap_duration"),
                                "s1": r.get("duration_sector_1"),
                                "s2": r.get("duration_sector_2"),
                                "s3": r.get("duration_sector_3"),
                            }
                            if int(lap_num) > self._current_lap:
                                self._current_lap = int(lap_num)

            elif channel == "stints":
                for r in records:
                    num = str(r.get("driver_number", ""))
                    if num:
                        self._stints[num] = {
                            "compound": str(r.get("compound", "MEDIUM")).upper(),
                            "tyre_age": float(r.get("tyre_age_at_start", 0)),
                        }

            elif channel == "race_control":
                for r in records:
                    flag = str(r.get("flag", "")).upper()
                    category = str(r.get("category", "")).upper()
                    msg = str(r.get("message", "")).upper()

                    if "VSC" in msg or "VIRTUAL SAFETY CAR" in msg:
                        self._track_status = "6"
                        self._active_flags = ["VSC"]
                    elif "SAFETY CAR" in msg or category == "SAFETY CAR":
                        self._track_status = "4"
                        self._active_flags = ["SC"]
                    elif flag == "RED" or "RED FLAG" in msg:
                        self._track_status = "5"
                        self._active_flags = ["RED"]
                    elif flag == "YELLOW" or "YELLOW" in msg:
                        self._track_status = "2"
                        self._active_flags = ["YELLOW"]
                    elif flag in ["CLEAR", "GREEN"] or "TRACK CLEAR" in msg:
                        self._track_status = "1"
                        self._active_flags = ["GREEN"]

            elif channel == "weather":
                if records:
                    latest = records[-1]
                    rainfall = latest.get("rainfall", 0)
                    self._weather = "WET" if rainfall and rainfall > 0 else "DRY"

    def next_state(self) -> Optional[RaceState]:
        """Emit the next coherent field-wide RaceState normalized from OpenF1 records."""
        with self._lock:
            if not self._is_running or self._is_paused:
                return None

            now = time.time()
            data_age = max(0.0, round(now - self._last_data_receive_ts, 2))

            # Build normalized CarState dictionary
            cars_dict: Dict[str, CarState] = {}

            # All active drivers observed in feed
            active_driver_numbers = list(self._drivers.keys())
            if not active_driver_numbers and self._positions:
                active_driver_numbers = list(self._positions.keys())

            # Sort drivers by running position
            def pos_sort(num: str) -> int:
                return self._positions.get(num, 99)

            sorted_nums = sorted(active_driver_numbers, key=pos_sort)

            for fallback_pos, num in enumerate(sorted_nums, start=1):
                d_meta = self._drivers.get(num, {
                    "code": f"#{num}",
                    "name": f"Driver {num}",
                    "team": "Independent",
                    "color": "#94a3b8",
                })
                code = d_meta["code"]
                pos = self._positions.get(num, fallback_pos)

                # Telemetry
                c_data = self._car_data.get(num, {})
                loc = self._locations.get(num, {})
                interval_data = self._intervals.get(num, {})
                stint_data = self._stints.get(num, {})

                # Parse gap to leader and car ahead
                raw_leader_gap = interval_data.get("gap_to_leader")
                leader_gap = None
                if raw_leader_gap is not None:
                    try:
                        leader_gap = float(raw_leader_gap)
                    except (ValueError, TypeError):
                        pass

                raw_ahead_interval = interval_data.get("interval")
                ahead_gap = None
                if raw_ahead_interval is not None and pos > 1:
                    try:
                        ahead_gap = float(raw_ahead_interval)
                    except (ValueError, TypeError):
                        pass

                # Assemble normalized CarState
                cars_dict[code] = CarState(
                    driver=code,
                    number=num,
                    name=d_meta.get("name"),
                    team=d_meta.get("team"),
                    color=d_meta.get("color"),
                    position=pos,
                    gap_to_leader=leader_gap,
                    gap_to_car_ahead=ahead_gap,
                    speed=float(c_data["speed"]) if c_data.get("speed") is not None else None,
                    tyre_compound=stint_data.get("compound", "MEDIUM"),
                    tyre_age=stint_data.get("tyre_age", float(self._current_lap)),
                    pit_status="ON_TRACK",
                    drs_active=c_data.get("drs"),
                    x=float(loc["x"]) if loc.get("x") is not None else None,
                    y=float(loc["y"]) if loc.get("y") is not None else None,
                    progress=None,
                )

            session_state = SessionState(
                event_id=self.event_id,
                event_name=self.event_name,
                circuit=self.circuit_name,
                session_type=self.session_type,
                current_lap=self._current_lap,
                total_laps=self.total_laps,
                session_time=round(self._session_time, 2) if self._session_time else None,
                replay_time=None,
                data_mode="LIVE_FEED",
                source_mode="LIVE_FEED",
                provider="OPENF1_LIVE",
                meeting=self.event_name,
                last_update_timestamp=now,
                data_age=data_age,
            )

            track_state = TrackState(
                track_status=self._track_status,
                sector=1,
                weather=self._weather,
                active_flags=self._active_flags,
                event_config_available=True,
            )

            race_state = RaceState(
                session=session_state,
                track=track_state,
                cars=cars_dict,
                timestamp=round(now, 2),
            )

            # Record to local session capture file if capture is active
            if self.capture_writer:
                try:
                    self.capture_writer.append_frame(race_state)
                except Exception as e:
                    logger.error(f"Failed to append capture frame: {e}")

            return race_state

    def get_metadata(self) -> ProviderMetadata:
        """Return provider provenance and live connectivity metadata."""
        now = time.time()
        age = max(0.0, round(now - self._last_data_receive_ts, 2))
        return ProviderMetadata(
            name="OpenF1 Real-Time Live Feed Provider",
            provider_type="OPENF1_LIVE",
            source_identifier=f"{self.base_url} [session={self.session_key or 'DISCOVERING'}]",
            provenance="REAL_PUBLIC_TELEMETRY (LIVE_FEED)",
            source_mode="LIVE_FEED",
            meeting=self.event_name,
            session=self.session_type,
            last_update_timestamp=self._last_data_receive_ts,
            data_age=age,
            details={
                "session_key": self.session_key,
                "meeting_key": self.meeting_key,
                "active_cars": len(self._drivers) or len(self._positions),
                "transport": "MQTT" if self._mqtt_client and self._mqtt_client.is_connected() else "REST_SYNC",
                "capture_active": self.capture_writer is not None,
            },
        )

    def get_capabilities(self) -> ProviderCapabilities:
        """Return provider capabilities."""
        return ProviderCapabilities(
            can_seek=False,
            can_pause=False,
            supported_playback_speeds=[1.0],
            is_live=True,
            max_frequency_hz=4.0,
            can_capture=True,
        )

    def _fetch_drivers_roster(self) -> None:
        """Fetch drivers roster via OpenF1 REST API."""
        if not self.session_key:
            return
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        url = f"{self.base_url.rstrip('/')}/drivers"
        try:
            resp = requests.get(url, params={"session_key": self.session_key}, headers=headers, timeout=4.0)
            if resp.status_code == 200:
                self.ingest_records("drivers", resp.json())
        except Exception:
            pass

    def _connect_mqtt(self) -> None:
        """Connect to OpenF1 MQTT streaming broker if paho-mqtt is available."""
        try:
            import paho.mqtt.client as mqtt

            client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
            if self.username and self.password:
                client.username_pw_set(self.username, self.password)
            elif self.token:
                client.username_pw_set("token", self.token)

            def on_connect(c, userdata, flags, rc, properties=None):
                if rc == 0:
                    topic = f"openf1/v1/live/{self.session_key or '+'}/#"
                    c.subscribe(topic)
                    logger.info(f"Connected to OpenF1 MQTT. Subscribed to {topic}")

            def on_message(c, userdata, msg):
                try:
                    import json
                    topic_parts = msg.topic.split("/")
                    channel = topic_parts[-1] if topic_parts else "unknown"
                    payload = json.loads(msg.payload.decode("utf-8"))
                    records = payload if isinstance(payload, list) else [payload]
                    self.ingest_records(channel, records)
                except Exception as ex:
                    logger.debug(f"Error parsing MQTT message: {ex}")

            client.on_connect = on_connect
            client.on_message = on_message

            # Non-blocking connection attempt
            client.connect_async(self.mqtt_broker, self.mqtt_port, keepalive=60)
            client.loop_start()
            self._mqtt_client = client
        except Exception as e:
            logger.info(f"OpenF1 MQTT connector in standby (using REST synchronization): {e}")
            self._mqtt_client = None

    def _poll_loop(self) -> None:
        """Resilient polling loop across active channels."""
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        channels = ["car_data", "location", "position", "intervals", "laps", "race_control", "weather"]

        while self._is_running:
            if not self.session_key:
                time.sleep(2.0)
                continue

            for ch in channels:
                if not self._is_running:
                    break
                try:
                    url = f"{self.base_url.rstrip('/')}/{ch}"
                    params = {"session_key": self.session_key}
                    resp = requests.get(url, params=params, headers=headers, timeout=3.0)
                    if resp.status_code == 200:
                        records = resp.json()
                        if records and isinstance(records, list):
                            self.ingest_records(ch, records)
                except Exception:
                    pass
                time.sleep(0.1)

            time.sleep(0.5)
