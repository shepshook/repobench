# RepoBench

RepoBench is a high-fidelity benchmarking suite designed to evaluate AI coding agents in deterministic, isolated environments. It automates the entire pipeline from discovering real-world bug fixes to scoring agent performance via regression testing.

## 🚀 Architecture

RepoBench follows a **Pipe-and-Filter** architecture to ensure reproducibility and isolation:

`Git Repo` $\rightarrow$ `Miner` $\rightarrow$ `SQLite (Candidates)` $\rightarrow$ `Sandbox` $\rightarrow$ `Session (Agent)` $\rightarrow$ `Judge` $\rightarrow$ `Leaderboard`

### Core Components

- **Miner**: Heuristic-based discovery of bug-fix pairs from Git history.
- **Sandbox**: Docker-based isolation that manages pre-fix and post-fix environments.
- **Session**: A PTY-based orchestration layer that allows interactive AI agents to operate within the sandbox.
- **Judge**: A scoring engine that uses regression testing (ensuring tests fail before the fix and pass after) to verify correctness.
- **Adapters**: A pluggable layer (`IAgentAdapter`) that translates between the RepoBench session and specific agent CLIs (e.g., Aider, Claude Code).

## 🛠 Usage

### Prerequisites
- Node.js 20+
- Docker (installed and running)

### Installation
```bash
npm install
```

### Workflow

#### 1. Mine Candidates
Discover bug-fix pairs from a target repository to build your benchmark dataset.
```bash
npm run start -- mine <repository-url>
```

#### 2. Run Batch Evaluation
Execute multiple agents against the mined candidates.
```bash
# Run a specific set of agents with concurrency
npm run start -- run-all -a claude-code,aider --concurrency 4
```

#### 3. Generate Reports
View the performance results and leaderboard.
```bash
npm run start -- report
```

#### 4. Dataset Management
Export and import candidate datasets for portability.
```bash
npm run start -- export ./dataset.jsonl
npm run start -- import ./dataset.jsonl
```

## 🔌 Extending RepoBench (Adding New Agents)

RepoBench uses the **Adapter Pattern** to support new agents. To benchmark a new agent (like `opencode`):

1. **Implement `IAgentAdapter`**: Create a new adapter class in `src/infrastructure/agents/` that implements the `IAgentAdapter` interface.
2. **Define Interaction Map**: Provide a regex-based map to handle agent-specific prompts and responses.
3. **Register Adapter**: Add the adapter to the `AgentAdapterFactory` in `src/cli/index.ts`:
   ```typescript
   AgentAdapterFactory.registerAdapter('my-agent', MyAgentAdapter);
   ```
4. **Configure Agent**: Add the agent's configuration to the agent config loader.

## 🧪 Testing
```bash
npm test
```
