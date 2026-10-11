/* ─────────────────────────────────────────────────────────────
   content.js — the résumé, as chapters anchored to the cove.
   Source: GokulMV's résumé. Phone and email are deliberately
   not published here.
   ───────────────────────────────────────────────────────────── */
const Content = {
  name: 'GokulMV',
  role: 'Senior Software Engineer',
  place: 'Hyderabad, India',
  line: 'Seven years building Java backends that stay fast under load: p90 held at 200 ms through a 10× traffic surge. Lately, AI tooling too, with skills that cut bugs in AI-written code from 40% to 15%.',
  summary: 'Senior Software Engineer with seven years in Java, Spring Boot and event-driven systems at Thoughtworks, OpenText and Cognizant. I keep busy platforms fast (p90 at 200 ms through a 10× traffic increase; 50K+ API calls a minute over 600M+ records), make them recoverable (full disaster recovery cut from 6 hours to 3–4) and ship to production daily. Lately I build multi-agent debugging and GitHub Copilot skills that cut the share of bugs from AI-written code from 40% to 15%.',
  links: [['LinkedIn', 'https://linkedin.com/in/gokulmv', 'linkedin.com/in/gokulmv'], ['GitHub', 'https://github.com/GokulMV', 'github.com/GokulMV']],
  /* the letter in the bottle: edit freely; the contact lines close it */
  contact: { phone: '+91 80194 43788', tel: '+918019443788', email: 'reddy.gokul@gmail.com' },
  letter: {
    to: 'To the stranger who wandered in,',
    body: [
      'I’m Gokul, a software engineer in Hyderabad. You’ve found my little cove: a calm beach, a patient ocean, a fire that keeps the night company. I come here to slow down. The waves never hurry, and out here, neither do I.',
      'By day I build the systems people lean on without ever noticing them: Java, Kafka, the cloud, and lately the AI tooling that helps teams write better code. I love the quiet craft of it, making things fast, steady and kind to whoever looks after them next.',
      'If something here made you smile, or you’d just like to talk, write back. The bottle always finds its way to me.'
    ],
    close: 'Warmly,',
    sign: 'Gokul'
  },
  /* the journey, one bulb each */
  journey: [
    { when: '2018', title: 'Graduated', text: 'B.Tech, Electronics and Communications Engineering, JNTU Anantapur' },
    { when: '2019', title: 'Cognizant', text: 'Programmer Analyst, on the IVS Portal for a North American carmaker' },
    { when: '2021', title: 'OpenText', text: 'Software Engineer on the OT2 multi-tenant SaaS platform' },
    { when: '2023', title: 'Thoughtworks', text: 'Senior Consultant on an e-commerce customer-service platform' },
    { when: 'Today', title: 'Still building', text: 'Fast, steady backends, and AI tooling that helps teams write better code' }
  ],
  resumeProjects: [
    { name: 'Levitas Validators', tech: 'Java 17, Maven, GitHub Actions, Maven Central', license: 'Apache 2.0', text: 'Zero-dependency Java library that validates and masks Indian identifiers (GSTIN, PAN, IFSC, UPI, Aadhaar) offline; published on Maven Central.' },
    { name: 'Over&Out', tech: 'Swift, Apple Vision, Core ML, Core Audio, Accessibility API, Homebrew', license: 'GPL-3.0', text: 'macOS menu-bar app that uses on-device camera detection to mute the mic, turn off meeting video and pause media when you step away or take a call, then restores everything on return.' },
    { name: 'ClipHive', tech: 'C#, .NET, WPF, AES-256-GCM, Windows DPAPI, Windows.Media.Ocr', license: 'MIT', text: 'Windows clipboard manager with AES-256-GCM encryption at rest, offline OCR image search and zero network calls.' }
  ],
  education: { school: 'Jawaharlal Nehru Technological University (JNTU) Anantapur', degree: 'B.Tech, Electronics and Communications Engineering', year: '2018', where: 'Anantapur' },
  chapters: [
    {
      id: 'resume', label: 'Résumé', anchor: 'menu', cam: 'menu', wide: true,
      eyebrow: 'On the picnic table',
      title: 'Tonight’s menu'
    },
    {
      id: 'experience', label: 'Experience', anchor: 'journal', cam: 'journal',
      eyebrow: 'Stories by the fire',
      title: 'Where I’ve worked',
      body: [
        { kind: 'role', org: 'Thoughtworks', title: 'Senior Consultant (Senior SWE)', when: 'Dec 2023 – Present', where: 'Hyderabad',
          context: 'E-commerce customer-service platform · team of 14',
          points: [
            'Design and build Spring Boot microservices with Domain-Driven Design and Hexagonal Architecture, producing and consuming <b>millions of events</b> across teams over Kafka and SQS.',
            'Hold <b>p50 at 150 ms and p90 at 200 ms</b> through a <b>10× traffic increase</b> (3K → 30K API calls an hour) since the platform moved from agent-mediated to direct customer access.',
            'Rebuilt disaster recovery as automated Terraform provisioning plus scripted bootstrap, cutting full application recovery from a <b>6-hour SLA to 3–4 hours</b>.',
            'Ship to production daily through trunk-based delivery, feature toggles and GitHub Actions with <b>Trivy and OWASP Dependency-Check</b> gates; fix cloud and container vulnerabilities flagged by <b>Wiz</b>.',
            'Build and maintain a <b>multi-agent debugging workflow</b> that triages production errors from <b>AWS CloudWatch</b> logs and traces each failure to its likely root cause for engineers to verify and fix.',
            'Build <b>GitHub Copilot skills</b> for code review and Jira-to-spec generation that standardise AI-generated code across the team, cutting the share of bugs from AI-written code from <b>40% to 15%</b>.',
            'Adapt open-source skills to load only the context a task needs, cutting AI spend from <b>$80 to $50 per developer a month (38%)</b>; mentor engineers on when to reject AI-generated code.'
          ] },
        { kind: 'role', org: 'OpenText', title: 'Software Engineer', when: 'Jul 2021 – Dec 2023', where: 'Hyderabad',
          context: 'OT2 multi-tenant SaaS platform · team of 8–12',
          points: [
            'Sustained <b>50K+ API calls a minute at 100–120 ms</b> over <b>600M+ customer records</b> by tuning PostgreSQL queries and access patterns; met a 2-hour incident-response SLA with <b>New Relic</b>.',
            'Architected <b>OT2Central</b>, the replacement for Admin Center with graphical modelling of applications, tenants and subscriptions, and owned it end to end as product owner, full-stack developer and QA.',
            'Built <b>Admin Center</b> for multi-tenant tenant, subscription and user lifecycle management with RBAC, and <b>Entitlement Tenant Services</b>, the Protobuf-based backend authority for entitlements behind both products.',
            'Delivered an <b>Azure → GCP migration with zero downtime</b> as part of the platform migration team.',
            'Upgraded Angular 9 → 17 with no breaking changes and shipped operability tooling (failed-events view, batch-job controls, in-app API console) that removed Postman from the team’s daily workflow.'
          ] },
        { kind: 'role', org: 'Cognizant Technology Solutions', title: 'Programmer Analyst', when: 'Feb 2019 – Jul 2021', where: 'Hyderabad',
          context: 'IVS Portal · North American automotive OEM',
          points: [
            'Built backend services in Java 8, Spring Boot, Spring MVC and Hibernate/HQL over Oracle, replacing manual engineering workflows.',
            'Developed REST APIs for file upload and download on Amazon S3, and Spring Integration flows for inter-system communication.',
            'Delivered microservice components with JUnit coverage against SLA-bound release commitments.'
          ] }
      ]
    },
    {
      id: 'milestones', label: 'Milestones', anchor: 'lights', cam: 'lights',
      eyebrow: 'One bulb for each', title: 'The journey so far'
    },
    {
      id: 'projects', label: 'Projects', anchor: 'basket', cam: 'basket',
      eyebrow: 'Rolled up in the basket',
      title: 'Things I’ve built',
      body: [
        { kind: 'group', text: 'At Thoughtworks' },
        { kind: 'proj', name: 'Customer-service platform', tag: 'Spring Boot · Kafka · SQS · DDD · Hexagonal',
          text: 'Event-driven microservices for an e-commerce customer-service platform, producing and consuming millions of events across teams. Held p50 at 150 ms and p90 at 200 ms while traffic grew 10×, from 3K to 30K API calls an hour.' },
        { kind: 'proj', name: 'Disaster recovery, automated', tag: 'Terraform · scripted bootstrap · AWS',
          text: 'Rebuilt disaster recovery as automated provisioning plus a scripted bootstrap, cutting full application recovery from a 6-hour SLA to 3–4 hours.' },
        { kind: 'proj', name: 'Multi-agent debugging', tag: 'AI agents · AWS CloudWatch',
          text: 'A workflow of agents that triages production errors from CloudWatch logs and traces each failure to its likely root cause, for engineers to verify and fix.' },
        { kind: 'proj', name: 'GitHub Copilot skills', tag: 'Code review · Jira-to-spec · context-lean skills',
          text: 'Skills that standardise AI-generated code across the team: the share of bugs from AI-written code fell from 40% to 15%, and AI spend from $80 to $50 per developer a month.' },
        { kind: 'group', text: 'At OpenText' },
        { kind: 'proj', name: 'OT2Central', tag: 'Product owner · full-stack developer · QA',
          text: 'The replacement for Admin Center, with graphical modelling of applications, tenants and subscriptions. Architected it and owned it end to end.' },
        { kind: 'proj', name: 'Admin Center & Entitlement Tenant Services', tag: 'Multi-tenant · RBAC · Protocol Buffers',
          text: 'Tenant, subscription and user lifecycle management with RBAC, backed by Entitlement Tenant Services, the Protobuf-based authority for entitlements behind both products.' },
        { kind: 'proj', name: 'OT2 at scale', tag: 'PostgreSQL · New Relic',
          text: 'Tuned queries and access patterns to sustain 50K+ API calls a minute at 100–120 ms over 600M+ customer records, inside a 2-hour incident-response SLA.' },
        { kind: 'proj', name: 'Azure → GCP migration', tag: 'Platform migration team',
          text: 'Moved the platform from Azure to GCP with zero downtime.' },
        { kind: 'proj', name: 'Operability tooling', tag: 'Angular 9 → 17',
          text: 'A failed-events view, batch-job controls and an in-app API console that took Postman out of the team’s daily workflow, alongside an Angular 9 → 17 upgrade with no breaking changes.' },
        { kind: 'group', text: 'At Cognizant' },
        { kind: 'proj', name: 'IVS Portal', tag: 'Java 8 · Spring Boot · Hibernate · Oracle · Amazon S3',
          text: 'Backend services for a North American automotive OEM that replaced manual engineering workflows, with S3 file upload and download APIs and Spring Integration flows between systems.' },
        { kind: 'group', text: 'Open source' },
        { kind: 'proj', name: 'Levitas Validators', tag: 'Java 17 · Maven Central · Apache 2.0',
          text: 'A zero-dependency Java library that validates and masks Indian identifiers (GSTIN, PAN, IFSC, UPI, Aadhaar) offline.' },
        { kind: 'proj', name: 'Over&Out', tag: 'Swift · Apple Vision · Core ML · Homebrew · GPL-3.0',
          text: 'A macOS menu-bar app that sees, on-device, when you step away or take a call: it mutes the mic, turns off meeting video and pauses media, then restores everything when you are back.' },
        { kind: 'proj', name: 'ClipHive', tag: 'C# · .NET · WPF · MIT',
          text: 'A Windows clipboard manager with AES-256-GCM encryption at rest, offline OCR image search and zero network calls.' }
      ]
    },
    {
      id: 'stack', label: 'Stack', anchor: 'clipboard', cam: 'van',
      eyebrow: 'What travels with me',
      title: 'Stack',
      body: [
        { kind: 'stack', group: 'Languages', items: ['Java', 'SQL (MongoDB, PostgreSQL, MySQL, Oracle)', 'TypeScript', 'JavaScript', 'HTML/CSS'] },
        { kind: 'stack', group: 'Backend frameworks', items: ['Spring Boot', 'Spring (Core, Data, MVC, Security)', 'Hibernate/JPA', 'JUnit'] },
        { kind: 'stack', group: 'Frontend frameworks', items: ['Angular', 'React', 'Vue.js', 'Single SPA (micro frontends)', 'Jasmine'] },
        { kind: 'stack', group: 'APIs & protocols', items: ['REST', 'gRPC', 'Protocol Buffers', 'OAuth 2.0'] },
        { kind: 'stack', group: 'Data & messaging', items: ['Apache Kafka', 'AWS SQS/SNS', 'MongoDB', 'DynamoDB'] },
        { kind: 'stack', group: 'Cloud & DevOps', items: ['AWS (EC2, S3, Lambda)', 'GCP', 'Terraform', 'Docker', 'Kubernetes', 'GitHub Actions', 'Jenkins'] },
        { kind: 'stack', group: 'Architecture', items: ['Microservices', 'Event-driven architecture', 'DDD', 'Hexagonal architecture', 'Multi-tenant systems', 'RBAC', 'HLD/LLD'] },
        { kind: 'stack', group: 'AI & LLM', items: ['LangChain4j', 'MCP (Model Context Protocol)', 'RAG pipelines'] },
        { kind: 'stack', group: 'Observability', items: ['Splunk', 'Datadog', 'New Relic', 'Grafana', 'AWS CloudWatch'] },
        { kind: 'stack', group: 'Security & code quality', items: ['Wiz', 'Trivy', 'OWASP Dependency-Check', 'SonarQube'] },
        { kind: 'stack', group: 'Developer tools', items: ['Git', 'Claude Code', 'GitHub Copilot'] }
      ]
    },
    {
      id: 'contact', label: 'Contact', anchor: 'bottle', cam: 'bottle',
      eyebrow: 'Message in a bottle', title: 'A letter'
    }
  ]
};
