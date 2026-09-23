import type { TopicCandidate } from '../types.js';

/**
 * Curated pool of candidate topics (SPEC section 20). The topic engine
 * filters/ranks this catalog rather than picking randomly from thin air,
 * which keeps generated content technically grounded and on-strategy.
 *
 * Difficulty tags feed the learning-progression logic (SPEC section 21/58).
 */
export const TOPIC_CATALOG: TopicCandidate[] = [
  // --- Virtualization -------------------------------------------------
  { topic: 'What is a hypervisor?', category: 'Virtualization', difficulty: 'beginner', keywords: ['hypervisor', 'virtualization', 'vm'] },
  { topic: 'Type 1 vs Type 2 hypervisors', category: 'Virtualization', difficulty: 'beginner', keywords: ['hypervisor', 'type1', 'type2', 'virtualization'] },
  { topic: 'VM snapshots', category: 'Virtualization', difficulty: 'beginner', keywords: ['vm', 'snapshot', 'backup'] },
  { topic: 'VM cloning', category: 'Virtualization', difficulty: 'beginner', keywords: ['vm', 'cloning', 'templates'] },
  { topic: 'Virtual CPUs', category: 'Virtualization', difficulty: 'intermediate', keywords: ['vcpu', 'cpu', 'scheduling'] },
  { topic: 'Virtual memory in virtualized environments', category: 'Virtualization', difficulty: 'intermediate', keywords: ['memory', 'ballooning', 'virtualization'] },
  { topic: 'Virtual networking fundamentals', category: 'Virtualization', difficulty: 'intermediate', keywords: ['virtual switch', 'networking', 'vlan'] },
  { topic: 'VM resource allocation', category: 'Virtualization', difficulty: 'intermediate', keywords: ['cpu', 'memory', 'allocation'] },
  { topic: 'Resource overcommitment in virtualization', category: 'Virtualization', difficulty: 'advanced', keywords: ['overcommit', 'capacity', 'virtualization'] },
  { topic: 'High availability for virtual machines', category: 'Virtualization', difficulty: 'advanced', keywords: ['ha', 'failover', 'vm'] },
  { topic: 'Live migration of virtual machines', category: 'Virtualization', difficulty: 'advanced', keywords: ['live migration', 'vmotion', 'vm'] },

  // --- Containers -------------------------------------------------------
  { topic: 'Containers vs virtual machines', category: 'Containers', difficulty: 'beginner', keywords: ['containers', 'vm', 'isolation'] },
  { topic: 'Understanding Docker images', category: 'Containers', difficulty: 'beginner', keywords: ['docker', 'image', 'container'] },
  { topic: 'How Docker image layers work', category: 'Containers', difficulty: 'intermediate', keywords: ['docker', 'layers', 'caching'] },
  { topic: 'Docker networking basics', category: 'Containers', difficulty: 'intermediate', keywords: ['docker', 'networking', 'bridge'] },
  { topic: 'Docker volumes and data persistence', category: 'Containers', difficulty: 'intermediate', keywords: ['docker', 'volumes', 'storage'] },
  { topic: 'Container registries explained', category: 'Containers', difficulty: 'beginner', keywords: ['registry', 'docker hub', 'images'] },
  { topic: 'Container security basics', category: 'Containers', difficulty: 'advanced', keywords: ['container security', 'isolation', 'namespaces'] },

  // --- Kubernetes ---------------------------------------------------------
  { topic: 'Kubernetes Pods explained', category: 'Kubernetes', difficulty: 'beginner', keywords: ['kubernetes', 'pod', 'container'] },
  { topic: 'Kubernetes Deployments', category: 'Kubernetes', difficulty: 'beginner', keywords: ['kubernetes', 'deployment', 'rollout'] },
  { topic: 'Kubernetes Services', category: 'Kubernetes', difficulty: 'intermediate', keywords: ['kubernetes', 'service', 'networking'] },
  { topic: 'Kubernetes namespaces', category: 'Kubernetes', difficulty: 'intermediate', keywords: ['kubernetes', 'namespace', 'cluster'] },
  { topic: 'Kubernetes ConfigMaps', category: 'Kubernetes', difficulty: 'intermediate', keywords: ['kubernetes', 'configmap', 'configuration'] },
  { topic: 'Kubernetes Secrets', category: 'Kubernetes', difficulty: 'intermediate', keywords: ['kubernetes', 'secrets', 'security'] },
  { topic: 'Kubernetes Ingress', category: 'Kubernetes', difficulty: 'advanced', keywords: ['kubernetes', 'ingress', 'routing'] },
  { topic: 'Kubernetes ReplicaSets', category: 'Kubernetes', difficulty: 'intermediate', keywords: ['kubernetes', 'replicaset', 'scaling'] },
  { topic: 'Kubernetes StatefulSets', category: 'Kubernetes', difficulty: 'advanced', keywords: ['kubernetes', 'statefulset', 'storage'] },
  { topic: 'Kubernetes DaemonSets', category: 'Kubernetes', difficulty: 'advanced', keywords: ['kubernetes', 'daemonset', 'nodes'] },
  { topic: 'Kubernetes networking model', category: 'Kubernetes', difficulty: 'advanced', keywords: ['kubernetes', 'networking', 'cni'] },
  { topic: 'How the Kubernetes scheduler works', category: 'Kubernetes', difficulty: 'advanced', keywords: ['kubernetes', 'scheduler', 'nodes'] },

  // --- Linux / Networking -------------------------------------------------
  { topic: 'Linux file permissions explained', category: 'Linux', difficulty: 'beginner', keywords: ['linux', 'permissions', 'chmod'] },
  { topic: 'Linux processes and systemd basics', category: 'Linux', difficulty: 'intermediate', keywords: ['linux', 'systemd', 'process'] },
  { topic: 'Understanding the Linux filesystem hierarchy', category: 'Linux', difficulty: 'beginner', keywords: ['linux', 'filesystem', 'fhs'] },
  { topic: 'TCP vs UDP for cloud engineers', category: 'Networking', difficulty: 'beginner', keywords: ['tcp', 'udp', 'networking'] },
  { topic: 'DNS fundamentals for cloud infrastructure', category: 'Networking', difficulty: 'beginner', keywords: ['dns', 'networking', 'resolution'] },
  { topic: 'Subnetting fundamentals', category: 'Networking', difficulty: 'intermediate', keywords: ['subnet', 'cidr', 'networking'] },
  { topic: 'Load balancers: Layer 4 vs Layer 7', category: 'Networking', difficulty: 'intermediate', keywords: ['load balancer', 'layer4', 'layer7'] },

  // --- DevOps / CI-CD -------------------------------------------------------
  { topic: 'What CI/CD actually means', category: 'DevOps', difficulty: 'beginner', keywords: ['ci/cd', 'pipeline', 'devops'] },
  { topic: 'GitOps explained', category: 'DevOps', difficulty: 'intermediate', keywords: ['gitops', 'devops', 'automation'] },
  { topic: 'Infrastructure as Code fundamentals', category: 'DevOps', difficulty: 'beginner', keywords: ['iac', 'terraform', 'devops'] },
  { topic: 'Deployment strategies overview', category: 'DevOps', difficulty: 'intermediate', keywords: ['deployment', 'strategy', 'devops'] },
  { topic: 'Blue/green deployment explained', category: 'DevOps', difficulty: 'intermediate', keywords: ['blue-green', 'deployment', 'devops'] },
  { topic: 'Canary deployments explained', category: 'DevOps', difficulty: 'advanced', keywords: ['canary', 'deployment', 'devops'] },
  { topic: 'Designing safe rollback strategies', category: 'DevOps', difficulty: 'advanced', keywords: ['rollback', 'deployment', 'devops'] },

  // --- DevSecOps -------------------------------------------------------
  { topic: 'Container image scanning explained', category: 'DevSecOps', difficulty: 'intermediate', keywords: ['scanning', 'devsecops', 'security'] },
  { topic: 'SAST vs DAST explained', category: 'DevSecOps', difficulty: 'intermediate', keywords: ['sast', 'dast', 'devsecops'] },
  { topic: 'Dependency scanning in CI/CD', category: 'DevSecOps', difficulty: 'intermediate', keywords: ['dependency scanning', 'devsecops', 'ci/cd'] },
  { topic: 'What an SBOM actually is', category: 'DevSecOps', difficulty: 'advanced', keywords: ['sbom', 'devsecops', 'supply chain'] },
  { topic: 'Container image signing', category: 'DevSecOps', difficulty: 'advanced', keywords: ['image signing', 'devsecops', 'security'] },
  { topic: 'Secrets management fundamentals', category: 'DevSecOps', difficulty: 'intermediate', keywords: ['secrets', 'vault', 'devsecops'] },
  { topic: 'Kubernetes security basics', category: 'DevSecOps', difficulty: 'advanced', keywords: ['kubernetes', 'security', 'rbac'] },

  // --- Cloud fundamentals -------------------------------------------------
  { topic: 'IaaS vs PaaS vs SaaS explained', category: 'Cloud Computing', difficulty: 'beginner', keywords: ['iaas', 'paas', 'saas'] },
  { topic: 'Cloud regions and availability zones', category: 'Cloud Computing', difficulty: 'beginner', keywords: ['region', 'availability zone', 'cloud'] },
  { topic: 'How load balancers work in the cloud', category: 'Cloud Computing', difficulty: 'intermediate', keywords: ['load balancer', 'cloud', 'networking'] },
  { topic: 'Autoscaling fundamentals', category: 'Cloud Computing', difficulty: 'intermediate', keywords: ['autoscaling', 'cloud', 'scaling'] },
  { topic: 'Object storage explained', category: 'Cloud Computing', difficulty: 'beginner', keywords: ['object storage', 's3', 'cloud'] },
  { topic: 'Virtual networks in the cloud', category: 'Cloud Computing', difficulty: 'intermediate', keywords: ['vpc', 'virtual network', 'cloud'] },
  { topic: 'IAM fundamentals for cloud security', category: 'Cloud Security', difficulty: 'intermediate', keywords: ['iam', 'cloud security', 'access control'] },
  { topic: 'Cloud monitoring fundamentals', category: 'Observability', difficulty: 'intermediate', keywords: ['monitoring', 'observability', 'cloud'] },
  { topic: 'Observability: logs, metrics, and traces', category: 'Observability', difficulty: 'advanced', keywords: ['observability', 'logs', 'metrics', 'traces'] },

  // --- Terraform / Ansible -------------------------------------------------
  { topic: 'Terraform state explained', category: 'Terraform', difficulty: 'intermediate', keywords: ['terraform', 'state', 'iac'] },
  { topic: 'Terraform modules for reusable infrastructure', category: 'Terraform', difficulty: 'advanced', keywords: ['terraform', 'modules', 'iac'] },
  { topic: 'Ansible playbooks explained', category: 'Ansible', difficulty: 'beginner', keywords: ['ansible', 'playbook', 'automation'] },
  { topic: 'Idempotency in configuration management', category: 'Ansible', difficulty: 'advanced', keywords: ['idempotency', 'ansible', 'configuration'] },

  // --- AWS / Azure ----------------------------------------------------------
  { topic: 'AWS EC2 fundamentals', category: 'AWS', difficulty: 'beginner', keywords: ['aws', 'ec2', 'compute'] },
  { topic: 'AWS VPC fundamentals', category: 'AWS', difficulty: 'intermediate', keywords: ['aws', 'vpc', 'networking'] },
  { topic: 'Azure Virtual Machines fundamentals', category: 'Microsoft Azure', difficulty: 'beginner', keywords: ['azure', 'vm', 'compute'] },
  { topic: 'Azure Resource Groups explained', category: 'Microsoft Azure', difficulty: 'beginner', keywords: ['azure', 'resource group', 'management'] },
];

export function getCatalogByCategories(categories: string[]): TopicCandidate[] {
  const normalized = new Set(categories.map((c) => c.toLowerCase()));
  return TOPIC_CATALOG.filter((t) => normalized.has(t.category.toLowerCase()));
}
