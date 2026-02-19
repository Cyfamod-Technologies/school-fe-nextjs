import type { ReactNode } from 'react';
import './agent-ui.css';

export default function AgentLayout({ children }: { children: ReactNode }) {
  return <div className="agent-ui">{children}</div>;
}

