# CI/CD Setup for doSomeReps Production Deployment

## Architecture Overview

```
GitHub (public repo)                Your k3s cluster (node: jackie)
┌─────────────────────┐            ┌──────────────────────────────────┐
│ Push to master       │            │ Self-hosted GitHub Actions runner │
│       │              │            │       │                           │
│       ▼              │            │       ▼                           │
│ Workflow dispatch ───┼──triggers──▶ Runner picks up job              │
│ (KUBECONFIG secret)  │            │       │                           │
└─────────────────────┘            │       ▼                           │
                                   │ kubectl apply kaniko Job          │
                                   │       │                           │
                                   │       ▼                           │
                                   │ Wait for Job to complete           │
                                   │       │                           │
                                   │       ▼                           │
                                   │ kubectl rollout restart           │
                                   │ deployment/reps-prod              │
                                   └──────────────────────────────────┘
```

### Security Model

Since this is a public repo, the workflow runs on a **self-hosted runner** on your
own hardware. The kubeconfig and all credentials are stored as GitHub Secrets and
injected at runtime — they are never visible in the public repo.

- The ServiceAccount token has **minimal permissions** scoped only to the
  `reps-prod` namespace (jobs + deployments + pods/logs).
- Fork PRs will NOT trigger this workflow (only direct pushes to master).
- Protect the `master` branch with branch protection rules as an extra safeguard.

---

## Files in this Directory

| File | Purpose |
|---|---|
| `01-sa-rbac.yaml` | ServiceAccount, Role, RoleBinding, and token Secret for the CI runner |
| `.github/workflows/deploy-prod.yml` | The GitHub Actions workflow (in repo root) |

---

## Step 1: Apply RBAC on Your k3s Cluster

Run this on your k3s control-plane node:

```bash
kubectl apply -f k3/cicd/01-sa-rbac.yaml
```

Verify:

```bash
kubectl get sa github-actions-runner -n reps-prod
kubectl get role github-actions-runner -n reps-prod
kubectl get rolebinding github-actions-runner -n reps-prod
```

---

## Step 2: Extract the Token and Build a kubeconfig

Run these commands on your k3s control-plane node. They extract the SA token
and cluster CA to build a kubeconfig file for the runner.

```bash
# Get the token
SA_TOKEN=$(kubectl get secret github-actions-runner-token -n reps-prod \
  -o jsonpath='{.data.token}' | base64 -d)

# Get the API server URL
APISERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

# Get the cluster CA cert (base64-encoded)
CA_CERT=$(kubectl get secret github-actions-runner-token -n reps-prod \
  -o jsonpath='{.data.ca\.crt}')

# Write the kubeconfig file
cat > /tmp/ci-kubeconfig.yaml <<EOF
apiVersion: v1
kind: Config
clusters:
  - cluster:
      certificate-authority-data: ${CA_CERT}
      server: ${APISERVER}
    name: k3s-prod
contexts:
  - context:
      cluster: k3s-prod
      namespace: reps-prod
      user: github-actions-runner
    name: ci-context
current-context: ci-context
users:
  - name: github-actions-runner
    user:
      token: ${SA_TOKEN}
EOF

# Verify it works
KUBECONFIG=/tmp/ci-kubeconfig.yaml kubectl get pods -n reps-prod
```

If the verification command succeeds and lists pods, the kubeconfig is valid.

**Keep this file.** You will need its full contents for Step 5.

---

## Step 3: Install kubectl on Node "jackie" (if not present)

The self-hosted runner runs on `jackie` and needs `kubectl` to talk to the cluster.

```bash
# If k3s is installed on jackie, kubectl may already be available:
which kubectl

# If not, symlink the k3s-bundled kubectl (if k3s is on jackie):
sudo ln -s /usr/local/bin/k3s /usr/local/bin/kubectl

# Alternative: install standalone kubectl for ARM64
# curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
# chmod +x kubectl
# sudo mv kubectl /usr/local/bin/
```

---

## Step 4: Set Up the Self-Hosted GitHub Actions Runner on "jackie"

### 4a. Download and extract the runner

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner

curl -o actions-runner-linux-arm64-2.322.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.322.0/actions-runner-linux-arm64-2.322.0.tar.gz

tar xzf actions-runner-linux-arm64-2.322.0.tar.gz
```

> Check for the latest runner release at:
> https://github.com/actions/runner/releases

### 4b. Configure the runner

Go to your GitHub repo: **Settings > Actions > Runners > New self-hosted runner**.
Copy the token.

```bash
cd ~/actions-runner
./config.sh \
  --url https://github.com/Oktobrfest/doSomeReps \
  --token <YOUR_RUNNER_TOKEN> \
  --labels k3s-prod,arm64 \
  --name jackie-runner
```

When prompted:
- Runner group: press Enter (Default)
- Work folder: press Enter (default `_work`)
- Install as service: we'll do it manually next

### 4c. Install and start as a systemd service

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The runner should show as "Idle" in GitHub Actions > Runners.

### 4d. Place the kubeconfig on the runner machine

Copy the kubeconfig file from Step 2 to the runner machine (if jackie is
not the same machine as the control-plane node).

```bash
# On jackie, create the file with the contents of /tmp/ci-kubeconfig.yaml
mkdir -p ~/.kube

# Copy it over (scp from control-plane, or paste the contents manually)
# scp user@control-plane:/tmp/ci-kubeconfig.yaml ~/.kube/config-ci

# Alternatively, just paste the contents:
cat > ~/.kube/config-ci <<'PASTE_HERE'
# (paste the full kubeconfig from Step 2)
PASTE_HERE

chmod 600 ~/.kube/config-ci
```

---

## Step 5: Add GitHub Repository Secrets

Go to your repo: **Settings > Secrets and variables > Actions > New repository secret**.

Add these two secrets:

| Secret Name | Value |
|---|---|
| `KUBECONFIG` | The **full contents** of `/tmp/ci-kubeconfig.yaml` from Step 2 |
| `K3S_HOST` | IP/hostname:port of your k3s API server (e.g., `192.168.1.100:6443`) |

---

## Step 6: Protect the Master Branch (Recommended)

This prevents anyone from pushing directly to master without a PR review,
which protects your CI pipeline from malicious workflow modifications.

1. Go to repo **Settings > Branches > Add branch protection rule**.
2. Branch name pattern: `master`
3. Enable:
   - **Require a pull request before merging**
   - **Require approvals** (1 minimum)
   - **Dismiss stale pull request approvals when new commits are pushed**
   - (Optional) **Require status checks to pass before merging**

---

## How It Works (End-to-End)

1. You push to `master` (or merge a PR into master).
2. GitHub dispatches the workflow in `.github/workflows/deploy-prod.yml`.
3. The self-hosted runner on `jackie` picks up the job.
4. Runner checks out the repo and sets up kubeconfig from the `KUBECONFIG` secret.
5. Any stale `reps-build` job is deleted.
6. `kubectl apply -f k3/prod/10-kaniko-job.yaml` creates a new Kaniko build.
7. `kubectl wait` blocks until the job completes (up to 30 minutes).
8. On success: `kubectl rollout restart deployment/reps-prod` triggers a new pod.
9. `kubectl rollout status` waits for the new pod to be ready (up to 5 minutes).
10. Failure at any step prints the Kaniko build logs and exits non-zero.

### Manual Trigger

You can also trigger the workflow manually from the **Actions** tab >
**Deploy to Prod** > **Run workflow**.

---

## Troubleshooting

### Runner shows "Offline"

```bash
cd ~/actions-runner
sudo ./svc.sh status
sudo ./svc.sh restart
# Check logs:
journalctl -u actions.runner.* -f
```

### "kubectl: command not found"

Install kubectl on jackie (see Step 3).

### "Error from server (Forbidden)"

The ServiceAccount token may not have the right permissions.
Re-apply `k3/cicd/01-sa-rbac.yaml` and regenerate the kubeconfig.

### Kaniko job fails

```bash
# Check the job status and logs directly on the cluster:
kubectl get jobs -n reps-prod
kubectl logs job/reps-build -n reps-prod
kubectl describe job reps-build -n reps-prod
```

### Workflow not triggering

- Ensure the push is to the `master` branch.
- Check GitHub Actions > Deploy to Prod > check for any workflow runs.
- Verify the runner is "Idle" in Settings > Actions > Runners.

---

## Notes

- The `regcred` secret (Docker Hub credentials) referenced in `10-kaniko-job.yaml`
  must already exist in the `reps-prod` namespace on your cluster. It is not
  managed by this CI/CD setup.
- The Kaniko job uses `--context-sub-path=doSomeReps-master` which corresponds to
  the directory name inside the tarball from the `master` branch.
- The workflow timeout for the Kaniko build is 30 minutes (1800s). Adjust the
  `--timeout` value in the workflow if your builds take longer.
