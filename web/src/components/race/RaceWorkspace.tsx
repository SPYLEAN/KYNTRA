import React from 'react';
import type {
  ActiveBattleTracker,
  BattleWatchlistItem,
  CarState,
  DecisionSnapshot,
  EvidenceInspectionTarget,
  KyntraRuntimeSnapshot,
  TrackGeometry,
} from '../../types';
import { TimingTower } from './TimingTower';
import { TrackTwinZone } from './TrackTwinZone';
import { ActiveBattlesZone } from './ActiveBattlesZone';
import { HeroStrategyMatrix } from './HeroStrategyMatrix';
import { KyntraCallPanel } from './KyntraCallPanel';
import { WhyWhyNotPanel } from './WhyWhyNotPanel';
import { RobustnessPanel } from './RobustnessPanel';
import { PassWindowStrip } from './PassWindowStrip';
import { BottomIntelligence } from './BottomIntelligence';

interface RaceWorkspaceProps {
  runtimeSnapshot: KyntraRuntimeSnapshot | null;
  decision: DecisionSnapshot | null;
  cars: Record<string, CarState>;
  geometry: TrackGeometry | null;
  watchlist: BattleWatchlistItem[];
  activeBattles: ActiveBattleTracker[];
  selectedBattleId?: string | null;
  decisionHistory?: any[];
  trackStatus?: string;
  circuitName?: string;
  onSelectBattle: (battleId: string) => void;
  onSelectCar?: (driver: string) => void;
  onOpenEvidence: (target: EvidenceInspectionTarget) => void;
}

export const RaceWorkspace: React.FC<RaceWorkspaceProps> = ({
  runtimeSnapshot,
  decision,
  cars,
  geometry,
  watchlist,
  activeBattles,
  selectedBattleId,
  decisionHistory = [],
  trackStatus = '1',
  circuitName = 'Monza',
  onSelectBattle,
  onSelectCar,
  onOpenEvidence,
}) => {
  const currentMatrix = runtimeSnapshot?.current_matrix || (decision?.strategy_matrix as any) || null;
  const publishedCall = runtimeSnapshot?.published_call || (decision?.published_call as any) || null;
  const candidateCall = runtimeSnapshot?.candidate_call || (decision?.recommendation as any) || null;
  const callLifecycle = runtimeSnapshot?.call_lifecycle || publishedCall?.lifecycle_state || 'WITHHELD';

  const attackerCode = decision?.race.attacker || (selectedBattleId ? selectedBattleId.split('-')[0] : 'ANT');
  const defenderCode = decision?.race.defender || (selectedBattleId ? selectedBattleId.split('-')[1] : 'VER');
  const gapSeconds = decision?.battle.gap_seconds ?? 1.25;
  const closingRate = decision?.battle.closing_rate ?? 0.8;
  const distanceGapM = decision?.battle.distance_gap_m ?? Math.round(gapSeconds * 65);

  const overtake = decision?.overtake;
  const p1 = overtake?.p_1_lap ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_1_lap;
  const p2 = overtake?.p_2_laps ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_2_laps;
  const p3 = overtake?.p_3_laps ?? currentMatrix?.actions?.['OVERTAKE']?.pass_context?.p_pass_3_laps;

  const whySelected = publishedCall?.why_selected || candidateCall?.why_selected || [];
  const whyNot = publishedCall?.why_not || candidateCall?.why_not || {};
  const scenarioWinners = publishedCall?.scenario_winners || candidateCall?.scenario_winners;
  const robustnessVerdict = publishedCall?.robustness || candidateCall?.robustness;

  return (
    <div className="race-command-center-workspace">
      {/* =========================================================================
          ZONE 1: UPPER 3-COLUMN SECTOR (TIMING | TRACK TWIN | ACTIVE BATTLES)
          ========================================================================= */}
      <section className="race-zone-upper" aria-label="Upper Tactical Telemetry">
        {/* Left Column: Running Order Timing Tower */}
        <div className="upper-col upper-col-timing">
          <TimingTower
            cars={cars}
            attackerCode={attackerCode}
            defenderCode={defenderCode}
            selectedBattleId={selectedBattleId}
            onSelectCar={onSelectCar}
          />
        </div>

        {/* Center Column: Digital Track Twin Circuit Frame */}
        <div className="upper-col upper-col-twin">
          <TrackTwinZone
            geometry={geometry}
            cars={cars}
            attackerCode={attackerCode}
            defenderCode={defenderCode}
            gapSeconds={gapSeconds}
            closingRate={closingRate}
            distanceGapM={distanceGapM}
            trackStatus={trackStatus}
            circuitName={circuitName}
            onSelectCar={onSelectCar}
          />
        </div>

        {/* Right Column: Active Battles Watchlist */}
        <div className="upper-col upper-col-battles">
          <ActiveBattlesZone
            runtimeBattles={activeBattles}
            watchlist={watchlist}
            selectedBattleId={selectedBattleId}
            onSelectBattle={onSelectBattle}
          />
        </div>
      </section>

      {/* =========================================================================
          ZONE 2: HERO STRATEGIST MATRIX (CANONICAL 4-ACTION IMMUTABLE MATRIX)
          ========================================================================= */}
      <section className="race-zone-matrix" aria-label="Hero Strategist Matrix">
        <HeroStrategyMatrix
          matrix={currentMatrix}
          onOpenEvidence={onOpenEvidence}
        />
      </section>

      {/* =========================================================================
          ZONE 3: STRATEGIC CALL & DETERMINISTIC EVIDENCE
          ========================================================================= */}
      <section className="race-zone-call" aria-label="KYNTRA Call and Rationale">
        {/* Left Column: Big Unmistakable Call + Horizon Bar Strip */}
        <div className="call-zone-col call-zone-left">
          <KyntraCallPanel
            publishedCall={publishedCall}
            callLifecycle={callLifecycle}
            candidateCall={candidateCall}
            decisionSnapshotId={runtimeSnapshot?.decision_snapshot_id}
            onOpenEvidence={onOpenEvidence}
          />
          <PassWindowStrip
            p1={p1}
            p2={p2}
            p3={p3}
            pavApplied={true}
            onOpenEvidence={onOpenEvidence}
          />
        </div>

        {/* Right Column: Why / Why Not & Scenario Robustness */}
        <div className="call-zone-col call-zone-right">
          <WhyWhyNotPanel
            whySelected={whySelected}
            whyNot={whyNot}
            onOpenEvidence={onOpenEvidence}
          />
          <RobustnessPanel
            scenarioWinners={scenarioWinners}
            robustnessVerdict={robustnessVerdict}
            onClickEvidence={() =>
              onOpenEvidence({
                title: 'Battery & Recovery Scenario Robustness',
                value: robustnessVerdict || 'ROBUST WITHIN TESTED ASSUMPTIONS',
                status: 'VALID',
                provenance: 'DERIVED',
                method: '3-Scenario Assumption Sensitivity Sweep',
                evidenceItems: [
                  { label: 'Conservative Scenario', value: scenarioWinners?.['CONSERVATIVE'] || 'BUILD' },
                  { label: 'Nominal Scenario', value: scenarioWinners?.['NOMINAL'] || 'BUILD' },
                  { label: 'Favorable Scenario', value: scenarioWinners?.['FAVORABLE'] || 'BUILD' },
                ],
              })
            }
          />
        </div>
      </section>

      {/* =========================================================================
          ZONE 4: BOTTOM INTELLIGENCE TABS
          ========================================================================= */}
      <section className="race-zone-bottom" aria-label="Bottom Intelligence Panels">
        <BottomIntelligence
          runtimeSnapshot={runtimeSnapshot}
          decision={decision}
          decisionHistory={decisionHistory}
          onOpenEvidence={onOpenEvidence}
        />
      </section>
    </div>
  );
};
