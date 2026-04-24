<script lang="ts">
  import { api } from "$lib/api/client";

  let step = $state(0);
  let error = $state("");
  let testing = $state(false);

  // Step data
  let mode = $state<"standalone" | "multi-tenant">("standalone");

  // Database
  let dbEngine = $state<"sqlite" | "postgresql">("sqlite");
  let dbUrl = $state("./data/polis.db");
  let dbOk = $state(false);
  let detecting = $state(false);
  let pgDetected = $state(false);
  let pgSuperUrl = $state("");
  let pgDatabases = $state<string[]>([]);
  let creatingDb = $state(false);
  let dbCreated = $state(false);

  let aiProvider = $state("anthropic");
  let aiKey = $state("");
  let aiModel = $state("");
  let aiBaseUrl = $state("");
  let aiOk = $state(false);

  let adminName = $state("");
  let adminEmail = $state("");
  let adminPassword = $state("");
  let adminConfirm = $state("");

  let orgName = $state("");
  let orgType = $state("cooperative");

  let completing = $state(false);
  let done = $state(false);

  const steps = [
    "Welcome",
    "Deployment Mode",
    "Database",
    "AI Provider",
    "Admin Account",
    "Organization",
    "Review & Launch",
  ];

  // Auto-detect databases when entering the DB step
  async function detectDatabases() {
    detecting = true;
    error = "";
    try {
      const res = await api.setupDetectDb();
      if (res.postgresql.available) {
        pgDetected = true;
        pgSuperUrl = res.postgresql.connectionUrl ?? "";
        pgDatabases = res.postgresql.databases ?? [];
      }
    } catch (e: any) {
      // Detection failure is non-fatal
      console.warn("DB detection failed:", e.message);
    }
    detecting = false;
  }

  function onEngineChange(engine: "sqlite" | "postgresql") {
    dbEngine = engine;
    dbOk = false;
    dbCreated = false;
    error = "";
    if (engine === "sqlite") {
      dbUrl = "./data/polis.db";
    } else if (pgDetected && pgDatabases.includes("polis")) {
      dbUrl = pgSuperUrl.replace(/\/postgres$/, "/polis");
    } else {
      dbUrl = "postgresql://polis:polis@localhost:5432/polis";
    }
  }

  async function createPgDatabase() {
    creatingDb = true;
    error = "";
    try {
      const res = await api.setupCreateDb(pgSuperUrl);
      if (res.success && res.connectionUrl) {
        dbUrl = res.connectionUrl;
        dbCreated = true;
        // Auto-test the new connection
        await testDatabase();
      } else {
        error = res.error ?? "Failed to create database";
      }
    } catch (e: any) {
      error = e.message;
    }
    creatingDb = false;
  }

  async function testDatabase() {
    testing = true;
    error = "";
    try {
      const res = await api.setupTestDb(dbEngine, dbUrl);
      dbOk = res.success;
      if (!res.success) error = res.error ?? "Connection failed. Check URL and retry.";
    } catch (e: any) {
      error = e.message;
    }
    testing = false;
  }

  async function testAiProvider() {
    testing = true;
    error = "";
    try {
      const res = await api.setupTestAi(aiProvider, aiKey || undefined, aiModel || undefined, aiBaseUrl || undefined);
      aiOk = res.success;
      if (!aiOk) error = "AI provider test failed. Check credentials.";
    } catch (e: any) {
      error = e.message;
    }
    testing = false;
  }

  function canNext(): boolean {
    switch (step) {
      case 2: return dbOk;
      case 3: return aiOk;
      case 4: return !!adminName && !!adminEmail && !!adminPassword && adminPassword === adminConfirm && adminPassword.length >= 8;
      case 5: return !!orgName;
      default: return true;
    }
  }

  function onNext() {
    error = "";
    step++;
    // Trigger DB detection when entering step 2
    if (step === 2) detectDatabases();
  }

  async function finish() {
    completing = true;
    error = "";
    try {
      await api.setupComplete({
        deploymentMode: mode,
        database: { engine: dbEngine, url: dbUrl },
        ai: { provider: aiProvider, apiKey: aiKey || undefined, model: aiModel || undefined, baseUrl: aiBaseUrl || undefined },
        admin: { name: adminName, email: adminEmail, password: adminPassword },
        org: { name: orgName, type: orgType },
      });
      done = true;
    } catch (e: any) {
      error = e.message;
    }
    completing = false;
  }
</script>

<div class="wizard-page">
  <div class="wizard-container">
    <!-- Progress bar -->
    <div class="progress">
      {#each steps as s, i}
        <div class="step-dot" class:active={i === step} class:done={i < step}>
          <div class="dot">{i < step ? "✓" : i + 1}</div>
          <span class="step-label">{s}</span>
        </div>
        {#if i < steps.length - 1}
          <div class="step-line" class:filled={i < step}></div>
        {/if}
      {/each}
    </div>

    {#if done}
      <div class="card wizard-card">
        <div class="success-icon">🎉</div>
        <h2>Setup Complete!</h2>
        <p>POLIS is ready. Sign in with your admin account to get started.</p>
        <div class="success-details">
          <div><strong>Mode:</strong> {mode}</div>
          <div><strong>Org:</strong> {orgName}</div>
          <div><strong>Admin:</strong> {adminEmail}</div>
          <div><strong>AI:</strong> {aiProvider}</div>
        </div>
        <a href="/login" class="btn btn-primary" style="margin-top:20px">Sign In →</a>
      </div>
    {:else}
      <div class="card wizard-card">
        <!-- Step 0: Welcome -->
        {#if step === 0}
          <div class="welcome">
            <div class="logo">Π</div>
            <h1>Welcome to POLIS</h1>
            <p class="subtitle">AI-Governed Organization Platform</p>
            <p>This wizard will configure your POLIS instance. You'll set up:</p>
            <ul>
              <li>🏛️ Deployment mode (standalone or multi-tenant)</li>
              <li>🗄️ Database connection</li>
              <li>🤖 AI provider for the SAR engine</li>
              <li>👤 Admin account</li>
              <li>🏢 Your first organization</li>
            </ul>
          </div>

        <!-- Step 1: Deployment Mode -->
        {:else if step === 1}
          <h2>Choose Deployment Mode</h2>
          <p>This choice is permanent and cannot be changed later.</p>
          <div class="mode-grid">
            <button class="mode-card" class:selected={mode === "standalone"} onclick={() => mode = "standalone"}>
              <div class="mode-icon">🏠</div>
              <h3>Standalone</h3>
              <p>Single organization. Perfect for families, small teams, and communities.</p>
            </button>
            <button class="mode-card" class:selected={mode === "multi-tenant"} onclick={() => mode = "multi-tenant"}>
              <div class="mode-icon">🏢</div>
              <h3>Multi-Tenant</h3>
              <p>Host multiple organizations. SaaS platform with billing and admin panel.</p>
            </button>
          </div>

        <!-- Step 2: Database -->
        {:else if step === 2}
          <h2>Database</h2>
          <p>Choose where POLIS stores its data.</p>

          {#if detecting}
            <div class="detect-status">🔍 Detecting available databases...</div>
          {/if}

          <div class="mode-grid">
            <button class="mode-card" class:selected={dbEngine === "sqlite"} onclick={() => onEngineChange("sqlite")}>
              <div class="mode-icon">📁</div>
              <h3>SQLite</h3>
              <p>Zero config. Perfect for standalone, families, and small teams.</p>
              {#if mode === "standalone"}
                <span class="engine-badge recommended">Recommended</span>
              {/if}
            </button>
            <button class="mode-card" class:selected={dbEngine === "postgresql"} onclick={() => onEngineChange("postgresql")}>
              <div class="mode-icon">🐘</div>
              <h3>PostgreSQL</h3>
              <p>Full-featured. Required for multi-tenant. Best for larger deployments.</p>
              {#if pgDetected}
                <span class="engine-badge detected">✓ Detected</span>
              {:else if !detecting}
                <span class="engine-badge not-detected">Not detected</span>
              {/if}
            </button>
          </div>

          {#if dbEngine === "sqlite"}
            <label class="field">
              <span>Database File Path</span>
              <input type="text" bind:value={dbUrl} placeholder="./data/polis.db" class="mono" />
            </label>
            <p class="field-hint">Data stored in a single file. Easy to backup and move.</p>
          {:else}
            {#if pgDetected && !pgDatabases.includes("polis") && !dbCreated}
              <div class="pg-setup-box">
                <p>PostgreSQL is running but no <code>polis</code> database exists yet.</p>
                <button class="btn btn-primary" onclick={createPgDatabase} disabled={creatingDb}>
                  {creatingDb ? "Creating..." : "🐘 Create Database"}
                </button>
              </div>
            {:else if pgDetected && (pgDatabases.includes("polis") || dbCreated)}
              <div class="pg-setup-box success">
                <p>✅ PostgreSQL detected with <code>polis</code> database ready.</p>
              </div>
            {:else if !pgDetected && !detecting}
              <div class="pg-setup-box warning">
                <p>PostgreSQL not detected locally. Enter your connection URL below or install PostgreSQL first.</p>
              </div>
            {/if}
            <label class="field">
              <span>PostgreSQL URL</span>
              <input type="text" bind:value={dbUrl} placeholder="postgresql://polis:polis@localhost:5432/polis" class="mono" />
            </label>
          {/if}

          <div class="test-row">
            <button class="btn btn-outline" onclick={testDatabase} disabled={testing || !dbUrl}>
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {#if dbOk}
              <span class="test-ok">✅ Connected</span>
            {/if}
          </div>

        <!-- Step 3: AI Provider -->
        {:else if step === 3}
          <h2>AI Provider</h2>
          <p>Configure the AI backend for the SAR governance engine.</p>
          <label class="field">
            <span>Provider</span>
            <select bind:value={aiProvider} onchange={() => { aiOk = false; if (aiProvider === 'ollama' && !aiBaseUrl) aiBaseUrl = 'http://localhost:11434'; }}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </label>
          {#if aiProvider !== "ollama"}
            <label class="field">
              <span>API Key</span>
              <input type="password" bind:value={aiKey} placeholder="sk-..." />
            </label>
          {/if}
          {#if aiProvider === "ollama" || aiProvider === "custom"}
            <label class="field">
              <span>Base URL</span>
              <input type="text" bind:value={aiBaseUrl} placeholder={aiProvider === "ollama" ? "http://localhost:11434" : "https://api.example.com"} />
            </label>
          {/if}
          <label class="field">
            <span>Model (optional)</span>
            <input type="text" bind:value={aiModel} placeholder="auto-selected by task tier" />
          </label>
          <div class="test-row">
            <button class="btn btn-outline" onclick={testAiProvider} disabled={testing || (aiProvider !== 'ollama' && !aiKey)}>
              {testing ? "Testing..." : "Test Provider"}
            </button>
            {#if aiOk}
              <span class="test-ok">✅ Connected</span>
            {/if}
          </div>

        <!-- Step 4: Admin Account -->
        {:else if step === 4}
          <h2>Create Admin Account</h2>
          <p>This will be the first administrator with full access.</p>
          <label class="field">
            <span>Full Name</span>
            <input type="text" bind:value={adminName} placeholder="Your name" />
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" bind:value={adminEmail} placeholder="admin@example.com" />
          </label>
          <label class="field">
            <span>Password (min 8 chars)</span>
            <input type="password" bind:value={adminPassword} minlength="8" placeholder="••••••••" />
          </label>
          <label class="field">
            <span>Confirm Password</span>
            <input type="password" bind:value={adminConfirm} placeholder="••••••••" />
          </label>
          {#if adminPassword && adminConfirm && adminPassword !== adminConfirm}
            <p class="field-error">Passwords do not match</p>
          {/if}

        <!-- Step 5: Organization -->
        {:else if step === 5}
          <h2>Create Organization</h2>
          <p>Set up your first governed organization.</p>
          <label class="field">
            <span>Organization Name</span>
            <input type="text" bind:value={orgName} placeholder="Town of Maplewood" />
          </label>
          <label class="field">
            <span>Type</span>
            <select bind:value={orgType}>
              <option value="cooperative">Cooperative</option>
              <option value="municipality">Municipality / Town</option>
              <option value="family_trust">Family Trust</option>
              <option value="dao">DAO / Digital Org</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="hoa">HOA / Community</option>
              <option value="secret_society">Secret Society</option>
              <option value="custom">Custom</option>
            </select>
          </label>

        <!-- Step 6: Review -->
        {:else if step === 6}
          <h2>Review & Launch</h2>
          <p>Confirm your configuration before finalizing.</p>
          <div class="review-grid">
            <div class="review-item">
              <div class="review-label">Mode</div>
              <div class="review-value">{mode}</div>
            </div>
            <div class="review-item">
              <div class="review-label">Database</div>
              <div class="review-value mono">{dbEngine === "sqlite" ? `SQLite: ${dbUrl}` : dbUrl.replace(/:[^:@]+@/, ':***@')}</div>
            </div>
            <div class="review-item">
              <div class="review-label">AI Provider</div>
              <div class="review-value">{aiProvider} {aiModel ? `(${aiModel})` : ""}</div>
            </div>
            <div class="review-item">
              <div class="review-label">Admin</div>
              <div class="review-value">{adminName} ({adminEmail})</div>
            </div>
            <div class="review-item">
              <div class="review-label">Organization</div>
              <div class="review-value">{orgName} — {orgType}</div>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="wizard-error">{error}</div>
        {/if}

        <div class="wizard-nav">
          {#if step > 0}
            <button class="btn btn-outline" onclick={() => { step--; error = ""; }}>← Back</button>
          {:else}
            <div></div>
          {/if}

          {#if step < 6}
            <button class="btn btn-primary" onclick={onNext} disabled={!canNext()}>
              {step === 0 ? "Get Started →" : "Next →"}
            </button>
          {:else}
            <button class="btn btn-gold" onclick={finish} disabled={completing}>
              {completing ? "Setting up..." : "🚀 Launch POLIS"}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .wizard-page {
    min-height: 100vh;
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }
  .wizard-container { width: 100%; max-width: 680px; }

  .progress { display: flex; align-items: center; margin-bottom: 32px; }
  .step-dot { display: flex; flex-direction: column; align-items: center; position: relative; }
  .dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600;
    background: white; border: 2px solid var(--border); color: var(--ink3);
    transition: all 0.2s;
  }
  .step-dot.active .dot { background: var(--navy); border-color: var(--navy); color: white; }
  .step-dot.done .dot { background: var(--green); border-color: var(--green); color: white; }
  .step-label { font-size: 9px; color: var(--ink3); margin-top: 4px; white-space: nowrap; }
  .step-dot.active .step-label { color: var(--navy); font-weight: 600; }
  .step-line { flex: 1; height: 2px; background: var(--border); margin: 0 4px; margin-bottom: 18px; }
  .step-line.filled { background: var(--green); }

  .wizard-card { min-height: 380px; display: flex; flex-direction: column; }
  .wizard-card h2 { font-family: "DM Serif Display", serif; margin-bottom: 8px; }
  .wizard-card > p { color: var(--ink3); font-size: 14px; margin-bottom: 20px; }

  .welcome { text-align: center; }
  .logo {
    width: 64px; height: 64px; background: var(--navy); color: white;
    display: flex; align-items: center; justify-content: center;
    font-family: "DM Serif Display", serif; font-size: 36px;
    border-radius: 14px; margin: 0 auto 16px;
  }
  .welcome h1 { font-family: "DM Serif Display", serif; letter-spacing: 0.15em; }
  .welcome .subtitle { color: var(--ink3); font-size: 14px; margin-bottom: 20px; }
  .welcome ul { text-align: left; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
  .welcome li { font-size: 14px; padding: 10px 16px; background: var(--paper); border-radius: 8px; }

  .mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .mode-card {
    padding: 24px; border: 2px solid var(--border); border-radius: 12px;
    text-align: center; transition: all 0.15s; background: white;
  }
  .mode-card:hover { border-color: var(--navy); }
  .mode-card.selected { border-color: var(--navy); background: #f0f4ff; }
  .mode-icon { font-size: 32px; margin-bottom: 10px; }
  .mode-card h3 { margin-bottom: 6px; }
  .mode-card p { font-size: 12px; color: var(--ink3); line-height: 1.5; }

  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field span { font-size: 13px; font-weight: 500; color: var(--ink2); }
  .field-error { color: var(--red); font-size: 12px; }

  .test-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .test-ok { color: var(--green); font-size: 13px; font-weight: 500; }

  .detect-status { font-size: 13px; color: var(--ink3); padding: 8px 0; }

  .engine-badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    padding: 2px 8px; border-radius: 10px; margin-top: 8px;
  }
  .engine-badge.recommended { background: #dcfce7; color: #166534; }
  .engine-badge.detected { background: #dcfce7; color: #166534; }
  .engine-badge.not-detected { background: #fef3c7; color: #92400e; }

  .field-hint { font-size: 12px; color: var(--ink3); margin-top: -8px; margin-bottom: 12px; }

  .pg-setup-box {
    padding: 14px 16px; border-radius: 8px; margin-bottom: 14px;
    background: #fef3c7; border: 1px solid #fbbf24; font-size: 13px;
  }
  .pg-setup-box.success { background: #dcfce7; border-color: #86efac; }
  .pg-setup-box.warning { background: #fef3c7; border-color: #fbbf24; }
  .pg-setup-box p { margin-bottom: 8px; color: var(--ink); }
  .pg-setup-box code { background: rgba(0,0,0,0.08); padding: 1px 4px; border-radius: 3px; font-size: 12px; }

  .review-grid { display: flex; flex-direction: column; gap: 12px; }
  .review-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--paper2); }
  .review-label { font-size: 13px; color: var(--ink3); font-weight: 500; }
  .review-value { font-size: 13px; font-weight: 500; }

  .wizard-error { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 16px; }

  .wizard-nav { display: flex; justify-content: space-between; margin-top: auto; padding-top: 24px; }

  .success-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
  .success-details { background: var(--paper); padding: 16px; border-radius: 8px; margin-top: 16px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
</style>
