import { useEffect, useState } from 'react';
import { executeWebMCPTool, getWebMCPToolDefinitions, readWebMCPExecutionLog, clearWebMCPExecutionLog } from '../webmcp/registerTools';
import { subscribeWebMCPExecutionLog } from '../webmcp/executionLog';
import type { ToolName } from '../webmcp/toolDefinitions';

export function WebMCPInspector() {
  const [selected, setSelected] = useState<ToolName>('get_country_state');
  const [input, setInput] = useState('{}');
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState(readWebMCPExecutionLog());
  const [registered, setRegistered] = useState<string[]>([]);
  const definitions = getWebMCPToolDefinitions();
  useEffect(() => {
    const refresh = () => setLogs(readWebMCPExecutionLog());
    const unsubscribe = subscribeWebMCPExecutionLog(refresh);
    const context = document.modelContext;
    if (typeof context?.getTools === 'function') void context.getTools().then((tools) => setRegistered(tools.map((tool) => tool.name))).catch(() => setRegistered([]));
    return unsubscribe;
  }, []);
  const definition = definitions.find((tool) => tool.name === selected) ?? definitions[0];
  const supported = typeof document.modelContext?.registerTool === 'function';
  const run = async () => {
    try {
      const result = await executeWebMCPTool(selected, JSON.parse(input), { signal: new AbortController().signal });
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
    }
  };
  return (
    <aside className="webmcp-inspector" aria-label="WebMCP developer inspector">
      <div className="webmcp-inspector-heading"><div><p className="eyebrow">Developer mode</p><h2>WebMCP inspector</h2></div><span className={supported ? 'webmcp-supported' : 'webmcp-unavailable'}>{supported ? 'Available' : 'Unavailable'}</span></div>
      <p className="webmcp-inspector-note">Inspect the exact tools exposed to an agent. Manual runs use the same handlers as the browser integration.</p>
      <div className="webmcp-status-row"><span>{definitions.length} defined</span><span>{registered.length} registered</span></div>
      <label className="webmcp-field">Tool<select value={selected} onChange={(event) => setSelected(event.target.value as ToolName)}>{definitions.map((tool) => <option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></label>
      <p className="webmcp-description">{definition.description}</p>
      <details><summary>Input schema</summary><pre>{JSON.stringify(definition.inputSchema, null, 2)}</pre></details>
      <label className="webmcp-field">JSON input<textarea value={input} onChange={(event) => setInput(event.target.value)} rows={4} spellCheck={false} /></label>
      <button className="webmcp-run" onClick={run}>Run handler</button>
      {output && <details open><summary>Last output</summary><pre>{output}</pre></details>}
      <div className="webmcp-log-heading"><strong>Execution log</strong><button onClick={clearWebMCPExecutionLog}>Clear</button></div>
      <div className="webmcp-log">{logs.length ? logs.slice().reverse().map((entry) => <div className="webmcp-log-entry" key={`${entry.timestamp}-${entry.name}-${entry.duration}`}><strong>{entry.name}</strong><span className={entry.success ? 'webmcp-ok' : 'webmcp-error'}>{entry.success ? 'ok' : entry.error}</span><small>{entry.duration}ms · {entry.timestamp}</small></div>) : <span className="muted">No tool calls yet.</span>}</div>
    </aside>
  );
}
