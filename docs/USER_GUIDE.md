# User guide

A walkthrough of running an authorized engagement in LUNATIC PENTEST AI.

## 1. Sign in
Register to create your organization (you become its OWNER), or sign in. Enable
**MFA** under Settings → Security for production use.

## 2. Create a mission
**Missions → New mission.** Give it a name, pick a **mode** and **permission mode**:
- **Mode** — `CHAT` (conversational assistance) or `AGENT` (plan + execute).
- **Permission mode**:
  - `APPROVAL` — every step needs your explicit approval.
  - `SUPERVISED` — low-risk steps run automatically; medium/high need approval.
  - `AUTONOMOUS` — pre-authorized steps chain without per-step approval.
- **Agent profile** — `STANDARD` / `PRO` / `MAX` (real token/tool-budget configs).

Scope limits, prohibitions and resource caps always apply — even in AUTONOMOUS.

## 3. Define the authorized scope
Open the mission → **Scope** tab. Add `host`, `ip` or `cidr` entries for the
targets you are authorized to test. Use **Test a target against scope** to see
exactly what the scope guard will allow or block (it resolves DNS and blocks
private/reserved ranges — SSRF protection). Nothing outside this scope can be
acted on.

## 4a. CHAT mode
In the **Workspace** tab, describe the task or ask questions. With an AI provider
configured (Admin/Settings → AI providers) you get real assistant responses;
otherwise you get an explicit "not configured" notice — never a fabricated answer.

## 4b. AGENT mode
Open the **Agent** tab:
1. **Generate plan** — the mission is decomposed into ordered, scope-gated steps
   (authorization check → DNS recon → tooling).
2. **Step** / **Run** — the agent advances. Before each step it runs the scope
   guard; you can see the decision and the resolved IPs.
3. In APPROVAL/SUPERVISED mode, approve or reject pending steps.
4. **Emergency stop** halts everything immediately.

Tool steps run inside an isolated sandbox when a backend is available; otherwise
they show `AWAITING_SANDBOX`.

## 5. Findings & evidence
Findings are created from tool output with a state
(`POTENTIAL → DETECTED → REPRODUCED → CONFIRMED`, plus `FALSE_POSITIVE` /
`INCONCLUSIVE`). Use **Triage** on a finding to set its state, add a **CVSS v3.1
vector** (the score + severity are computed), and record remediation. A finding
can only be **CONFIRMED when it has at least one evidence record**. The evidence
trail is hash-chained and shown as an integrity badge.

## 6. The terminal & browser
- **Terminal** — an interactive shell inside the mission's isolated sandbox
  (resource-capped; commands never run on the app server).
- **Browser** — fetch an in-scope URL to inspect status, headers, redirects and a
  screenshot. Every request is SSRF-filtered; blocked sub-requests are listed.

## 7. Reports
**Reports → select the mission → Generate** (PDF / HTML / JSON / CSV). The report
includes the authorization scope, executive summary, methodology, findings with
CVSS/CWE/CVE/OWASP and remediation, the evidence-integrity status, and a
conclusion. Every conclusion is traceable to a hash-verified evidence record.
Download from the list.

## 8. Billing & admin
- **Billing** — your plan, credits and 30-day consumption; upgrade (needs Stripe
  configured on the deployment).
- **Admin** (requires `admin:users`) — members, roles, suspend/reinstate, system
  stats and the audit trail.

## Safety
This platform is for **authorized** testing only. The scope guard cannot be
widened by a conversational instruction, an uploaded file, or tool output. Do not
attempt to test systems you are not authorized to assess.
