'use client';

import { AgentChatPage } from '@/components/agent/AgentChatPage';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { ChannelsPage } from '@/components/harness/ChannelsPage';
import { SkillsPage } from '@/components/skills/SkillsPage';
import { DashboardKPI } from '@/components/dashboard/DashboardKPI';
import { MarketOverview } from '@/components/charts/MarketOverview';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { HarnessPanel } from '@/components/harness/HarnessPanel';
import { SafetyCenterPage } from '@/components/harness/SafetyCenterPage';
import { JournalPage } from '@/components/journal/JournalPage';
import { KnowledgeBasePage } from '@/components/knowledge/KnowledgeBasePage';
import { PortfolioPage } from '@/components/portfolio/PortfolioPage';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { WatchlistPage } from '@/components/watchlist/WatchlistPage';
import { WorkflowPage } from '@/components/workflow/WorkflowPage';
import {
  type ExecutionMode,
  getHarnessStatus,
  resetCircuitBreaker,
  setAgentMode,
  setHarnessMode,
  triggerCircuitBreaker,
} from '@/lib/api';
import { useEffect, useState } from 'react';

function DashboardView({
  mode,
  circuitBroken,
  onTriggerCircuit,
  onResetCircuit,
}: {
  mode: ExecutionMode;
  circuitBroken: boolean;
  onTriggerCircuit: () => void;
  onResetCircuit: () => void;
}) {
  return (
    <div className="flex flex-1 overflow-hidden gap-4 p-4">
      <div className="w-[380px] flex-shrink-0">
        <AgentPanel />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
        <DashboardKPI />
        <MarketOverview />
      </div>
      <div className="w-[340px] flex-shrink-0">
        <HarnessPanel
          mode={mode}
          circuitBroken={circuitBroken}
          onTriggerCircuit={onTriggerCircuit}
          onResetCircuit={onResetCircuit}
        />
      </div>
    </div>
  );
}

function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-hidden p-4">{children}</div>;
}

export type { ExecutionMode };

export default function Home() {
  const [mode, setMode] = useState<ExecutionMode>('dry_run');
  const [circuitBroken, setCircuitBroken] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [apiConnected, setApiConnected] = useState(true);

  // Fetch initial harness status from backend
  useEffect(() => {
    getHarnessStatus()
      .then((status) => {
        setMode(status.mode);
        setCircuitBroken(status.circuit_breaker.triggered);
        setApiConnected(true);
      })
      .catch(() => {
        console.warn('Backend not available, using local state');
        setApiConnected(false);
      });
  }, []);

  const handleModeChange = async (newMode: ExecutionMode) => {
    setMode(newMode);
    if (apiConnected) {
      try {
        await setAgentMode(newMode);
        await setHarnessMode(newMode);
      } catch {
        // fallback to local state
      }
    }
  };

  const handleTriggerCircuit = async () => {
    setCircuitBroken(true);
    if (apiConnected) {
      try {
        await triggerCircuitBreaker('手动触发');
      } catch {
        // fallback
      }
    }
  };

  const handleResetCircuit = async () => {
    setCircuitBroken(false);
    if (apiConnected) {
      try {
        await resetCircuitBreaker();
      } catch {
        // fallback
      }
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            mode={mode}
            circuitBroken={circuitBroken}
            onTriggerCircuit={handleTriggerCircuit}
            onResetCircuit={handleResetCircuit}
          />
        );
      case 'agent':
        return (
          <PageContainer>
            <AgentChatPage />
          </PageContainer>
        );
      case 'workflows':
        return (
          <PageContainer>
            <WorkflowPage />
          </PageContainer>
        );
      case 'channels':
        return (
          <PageContainer>
            <ChannelsPage />
          </PageContainer>
        );
      case 'skills':
        return (
          <PageContainer>
            <SkillsPage />
          </PageContainer>
        );
      case 'portfolio':
        return (
          <PageContainer>
            <PortfolioPage />
          </PageContainer>
        );
      case 'harness':
        return (
          <PageContainer>
            <SafetyCenterPage />
          </PageContainer>
        );
      case 'knowledge':
        return (
          <PageContainer>
            <KnowledgeBasePage />
          </PageContainer>
        );
      case 'watchlist':
        return (
          <PageContainer>
            <WatchlistPage />
          </PageContainer>
        );
      case 'journal':
        return (
          <PageContainer>
            <JournalPage />
          </PageContainer>
        );
      case 'settings':
        return (
          <PageContainer>
            <SettingsPage />
          </PageContainer>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          mode={mode}
          onModeChange={handleModeChange}
          circuitBroken={circuitBroken}
          onResetCircuit={handleResetCircuit}
        />
        {renderPage()}
      </div>
    </div>
  );
}
