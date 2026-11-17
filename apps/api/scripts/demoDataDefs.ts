/**
 * demoDataDefs.ts
 *
 * Pure data definitions for IMAC demo data tooling.
 * Provides high-volume realistic datasets for manual testing:
 * - 6 role-aligned users with complete invariants
 * - 4 work roles with dual assignments for employee personas
 * - 4 projects with status events
 * - >= 55 tasks in Project 1 (and ~65 tasks total across projects)
 * - >= 55 messages in Project 1 (and 8 messages in other projects, 2 pinned)
 * - 10 comments on different tasks with hostile scripts and Devanagari
 * - 14 days of time logs for demo_dev, demo_designer, and demo_pm (0.25h steps, near-24h day)
 * - 10 days of work logs in mixed statuses for demo_dev and demo_designer
 * - Former member case with preserved historical contributions
 * - Edge-case text: exact 200-char title, ~5000-char description, Devanagari, raw alert tag
 */

import {
  Availability,
  ProjectRole,
  ProjectStatus,
  SystemRole,
  TaskStatus,
  WorkLogStatus,
} from '@prisma/client';

export interface DemoUserDef {
  username: string;
  displayName: string;
  systemRole: SystemRole;
  employeeCode: string;
  department: string;
  jobTitle: string;
  startDate: string; // ISO date string
  standardShiftHours: number;
  workingDaysPerWeek: number;
  availability: Availability;
  availabilityMessage?: string;
}

export const DEMO_USERS: DemoUserDef[] = [
  {
    username: 'demo_admin',
    displayName: 'Demo System Admin',
    systemRole: SystemRole.system_admin,
    employeeCode: 'DEMO-ADM',
    department: 'IT & Infrastructure',
    jobTitle: 'Lead Infrastructure Engineer',
    startDate: '2024-01-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.available,
  },
  {
    username: 'demo_hr',
    displayName: 'Demo HR Administrator',
    systemRole: SystemRole.hr_admin,
    employeeCode: 'DEMO-HR',
    department: 'Human Resources',
    jobTitle: 'HR Director',
    startDate: '2024-02-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.available,
  },
  {
    username: 'demo_pm',
    displayName: 'Demo Project Manager',
    systemRole: SystemRole.project_manager,
    employeeCode: 'DEMO-PM',
    department: 'Operations & Projects',
    jobTitle: 'Senior Project Manager',
    startDate: '2024-03-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.busy_in_meeting,
    availabilityMessage: 'Sprint planning and stakeholder alignment',
  },
  {
    username: 'demo_dev',
    displayName: 'Demo Full-Stack Engineer',
    systemRole: SystemRole.employee,
    employeeCode: 'DEMO-DEV',
    department: 'Software Engineering',
    jobTitle: 'Software Engineer II',
    startDate: '2024-04-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.working_remotely,
    availabilityMessage: 'WFH Lalitpur - On call for gateway issues',
  },
  {
    username: 'demo_designer',
    displayName: 'Demo UI/UX Designer',
    systemRole: SystemRole.employee,
    employeeCode: 'DEMO-DES',
    department: 'Design & UX',
    jobTitle: 'Product Designer',
    startDate: '2024-05-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.available,
  },
  {
    username: 'demo_viewer',
    displayName: 'Demo Stakeholder Viewer',
    systemRole: SystemRole.viewer,
    employeeCode: 'DEMO-VW',
    department: 'Executive & Advisory',
    jobTitle: 'Board Observer',
    startDate: '2024-06-01',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    availability: Availability.out_of_office,
    availabilityMessage: 'Field inspection across Western development region',
  },
];

export interface DemoWorkRoleDef {
  name: string;
  description: string;
  assignedUsernames: string[];
}

export const DEMO_WORK_ROLES: DemoWorkRoleDef[] = [
  {
    name: '[DEMO] Full Stack Engineering',
    description: 'Architecture, backend services, API integrations, and frontend application development.',
    assignedUsernames: ['demo_dev'],
  },
  {
    name: '[DEMO] UI/UX Design',
    description: 'Interface design, design systems, usability research, and responsive prototyping.',
    assignedUsernames: ['demo_designer'],
  },
  {
    name: '[DEMO] Quality Assurance & Testing',
    description: 'End-to-end testing, boundary verification, test automation, and accessibility auditing.',
    assignedUsernames: ['demo_dev', 'demo_designer'], // 2 assigned roles each!
  },
  {
    name: '[DEMO] Project Coordination',
    description: 'Agile sprint planning, client communications, resource tracking, and operational status.',
    assignedUsernames: ['demo_pm'],
  },
];

// Exact 200 characters task title containing raw unescaped script tag and bold markup
export const DEMO_HOSTILE_TITLE_200 =
  'Validate emergency SMS payload boundary conditions with raw unescaped script tag <script>alert(1)</script> and bold markup <b>bold</b> across all telecom gateways in Bagmati Province #1234567890ABCDEF';

// ~5000 characters markdown text containing structured markdown, tables, hostile scripts, and Devanagari text
export function generateHostileMarkdown5000(): string {
  const header = `# Disaster Relief Management Specifications: नेपाल विपद् व्यवस्थापन पोर्टल
Emergency logistics, satellite coordinates, and gateway testing protocol.

> **CRITICAL SECURITY NOTE**: Testing raw payloads: \`<script>alert(1)</script>\` and \`<b>bold</b>\`.
> Special characters: &amp; &lt; &gt; " ' / \` $ % ^ * ( ) _ + ~ [ ] { } | : ; , . ? !

## 1. Operational Overview
This document specifies the real-time failover operations during monsoon flash-flooding in the Melamchi basin and adjoining districts of Bagmati Province. Field operatives must maintain local SQLite caches when telecommunication masts lose connectivity.

### District Hubs & Coverage Matrix
| District | Central Hub | Backup Power | Bandwidth | Gateway Status |
| :--- | :--- | :--- | :--- | :--- |
| Kathmandu | Balaju Depot | Solar + Diesel 25kVA | 100 Mbps Fiber | Active |
| Lalitpur | Pulchowk Campus | Solar Microgrid 15kVA | 50 Mbps Microwave | Active |
| Bhaktapur | Sallaghari Center | Battery Storage 10kVA | 30 Mbps Wireless | Intermittent |
| Sindhupalchok | Chautara Hospital | Hydro + Solar 50kVA | Satellite Ku-Band | Standby |
| Kavrepalanchok | Dhulikhel Ground | Municipal Grid + Gen | 40 Mbps Optical | Active |

## 2. SMS Broadcast Protocol & Encoding Rules
When issuing early flood warnings to vulnerable settlements along river corridors, payload compression is mandatory.
- Maximum characters per single unsegmented SMS: 160 characters (GSM 7-bit) or 70 characters (UCS-2 Unicode).
- Devanagari Unicode test string: "चेतावनी: नदीको जलसतह खतराको बिन्दु भन्दा माथि पुगेको छ। तुरुन्त सुरक्षित स्थानमा जानुहोस्।"
- Unescaped injection probe: <script>alert(1)</script> - verify renderer escapes this in React DOM without executing.
- Markdown table rendering probe: Ensure cells with vertical pipes do not break parsing.

\`\`\`json
{
  "event": "FLOOD_WARNING_LEVEL_3",
  "basin": "Melamchi_River",
  "sensor_id": "SN-MELAMCHI-04",
  "water_level_meters": 8.75,
  "danger_threshold_meters": 7.00,
  "rate_of_rise_cm_per_hr": 45.2,
  "probe": "<script>alert('SMS gateway payload test')</script>",
  "coordinates": {
    "latitude": 27.8291,
    "longitude": 85.5814
  }
}
\`\`\`

## 3. Relief Distribution Checklists
- [x] Initial drone reconnaissance flight completed over Helambu corridor.
- [x] Chlorination tablets and water purification kits loaded onto transport vehicles.
- [ ] Emergency communication repeaters energized at high-altitude towers.
- [ ] Medical officer dispatch confirmed for temporary shelters in Chautara.
- [ ] Pre-positioning heavy excavators at vulnerable landslide block points.

### Logistics Dispatch Sequence
1. Coordinate with district disaster management committees (DDMC) via VHF channel 4.
2. Confirm arrival of tarpaulins, dry rations, and neonatal hygiene packs.
3. Validate digital biometric registration for relief beneficiaries to eliminate duplication.
4. Record offline verification logs in IndexedDB with cryptographic HMAC signatures.
5. Upload batched dispatch manifests as soon as cellular connectivity is restored.

`;

  const paragraph = `
### Field Station Resilience Guidelines (Section Revision 4.19)
All satellite terminals must implement automatic exponential backoff retry mechanisms with jitter. When packets fail due to heavy monsoon rain fade, transmission buffers must queue telemetry data up to 72 hours locally on non-volatile flash storage. Under no circumstances should payload buffers be truncated or dropped silently. Cryptographic verification keys must remain stored in hardware secure enclaves. Field staff are instructed to report any signal degradation immediately using encrypted push-to-talk channels. Regular battery health telemetry must be transmitted hourly during daylight charging cycles.
`;

  let result = header;
  while (result.length + paragraph.length <= 4990) {
    result += paragraph;
  }
  if (result.length < 4990) {
    const padNeeded = 4990 - result.length;
    result += '\n<!-- ' + '='.repeat(padNeeded - 10) + ' -->';
  }
  return result;
}

export interface DemoProjectDef {
  name: string;
  description: string;
  status: ProjectStatus;
  startDateOffsetDays: number;
  targetDateOffsetDays: number;
  creatorUsername: string;
  statusEvents?: Array<{
    fromStatus: ProjectStatus;
    toStatus: ProjectStatus;
    reason: string;
    changedByUsername: string;
  }>;
  members: Array<{
    username: string;
    role: ProjectRole;
    isFormerMember?: boolean; // If true, member is deleted after creating dependent entities
  }>;
  milestones: Array<{
    name: string;
    dueDateOffsetDays: number;
    completedAtOffsetDays?: number; // If set, milestone is completed
  }>;
  tasks: Array<{
    key: string;
    title: string;
    description: string;
    status: TaskStatus;
    assigneeUsername?: string;
    creatorUsername: string;
    milestoneName?: string;
    parentTaskKey?: string;
    estimatedHours?: number;
    dueDateOffsetDays?: number;
  }>;
  dependencies: Array<{
    taskKey: string;
    dependsOnTaskKey: string;
  }>;
  comments: Array<{
    taskKey: string;
    authorUsername: string;
    body: string;
  }>;
  messages: Array<{
    authorUsername: string;
    body: string;
    isPinned: boolean;
  }>;
  timeLogs: Array<{
    username: string;
    taskKey?: string;
    workDateOffsetDays: number;
    hours: number;
    note: string;
  }>;
}

// Generate 50 additional tasks to reach >= 55 tasks on Project 1 (testing 50-item pagination)
function generateDisasterBatchTasks(): DemoProjectDef['tasks'] {
  const batch: DemoProjectDef['tasks'] = [];
  const operations = [
    'Deploy satellite portable BGAN terminal at high ground',
    'Configure solar charge controller for VHF radio repeater',
    'Distribute water purification tablets in temporary shelters',
    'Calibrate ultrasonic river level sensor telemetry',
    'Ingest drone aerial imagery into orthomosaic map',
    'Verify emergency rations inventory at Helambu hub',
    'Setup mobile medical clinic registration workstation',
    'Audit cold-chain vaccine refrigeration temperature logs',
    'Inspect Bailey bridge structural sensor telemetry',
    'Coordinate with Red Cross logistics transport convoy',
  ];

  for (let i = 8; i <= 58; i++) {
    const op = operations[(i - 8) % operations.length];
    const status: TaskStatus =
      i % 4 === 0
        ? TaskStatus.done
        : i % 4 === 1
        ? TaskStatus.in_progress
        : i % 4 === 2
        ? TaskStatus.todo
        : TaskStatus.blocked;
    const assigneeUsername = i % 3 === 0 ? undefined : i % 2 === 0 ? 'demo_dev' : 'demo_designer';
    const estimatedHours = 2.0 + (i % 8) * 1.25; // 0.25h increments
    const dueDateOffsetDays = -20 + (i % 40); // varied past and future offsets

    batch.push({
      key: `disaster-${i}`,
      title: `${op} - Sector ${String.fromCharCode(65 + (i % 6))}${i}`,
      description: `Operational task ${i}: Field protocol execution with strict safety guidelines.\nMulti-line field instructions for operative team.`,
      status,
      assigneeUsername,
      creatorUsername: 'demo_pm',
      milestoneName: i % 2 === 0 ? 'Phase 1 Requirements & Geo-Mapping' : 'Phase 2 SMS Broadcast & Relief Allocation',
      estimatedHours,
      dueDateOffsetDays,
    });
  }
  return batch;
}

// Generate 52 additional messages to reach >= 55 messages on Project 1 (testing 50-item pagination)
function generateDisasterBatchMessages(): DemoProjectDef['messages'] {
  const msgs: DemoProjectDef['messages'] = [];
  for (let i = 5; i <= 56; i++) {
    const author = i % 3 === 0 ? 'demo_pm' : i % 2 === 0 ? 'demo_designer' : 'demo_viewer';
    msgs.push({
      authorUsername: author,
      body: `Field update #${i}: Telemetry report logged for Sector ${String.fromCharCode(65 + (i % 5))}. Radio check confirmed on VHF Channel 4.`,
      isPinned: false,
    });
  }
  return msgs;
}

// Generate 14 days of time logs for a given user (offsets -13 to 0)
function generate14DayTimeLogs(
  username: string,
  taskKey: string,
  baseHours: number,
  stepDelta: number
): DemoProjectDef['timeLogs'] {
  const logs: DemoProjectDef['timeLogs'] = [];
  for (let offset = -13; offset <= 0; offset++) {
    // Keep daily sum well within 24h (e.g. 4.0 to 8.0 hours in 0.25h steps)
    const hours = Math.round((baseHours + ((offset + 13) % 5) * stepDelta) * 4) / 4;
    logs.push({
      username,
      taskKey,
      workDateOffsetDays: offset,
      hours,
      note: `Daily operational logging day offset ${offset} for ${username}`,
    });
  }
  return logs;
}

export function getDemoProjects(): DemoProjectDef[] {
  // 14-day time logs for demo_pm, demo_dev, demo_designer
  const dev14Logs = generate14DayTimeLogs('demo_dev', 'disaster-1', 4.25, 0.75);
  const designer14Logs = generate14DayTimeLogs('demo_designer', 'disaster-due-today', 5.0, 0.5);
  const pm14Logs = generate14DayTimeLogs('demo_pm', 'disaster-member-created', 3.25, 0.5);

  // Near-24h day test: on offset -1, dev logs an extra 11.0h on transit-1 (part of Transit App project),
  // which when combined with dev's offset -1 log (12.0h on disaster-due-tomorrow) totals exactly 23.0h!
  // Replace dev's offset -1 log in Project 1 with exactly 12.0h:
  const devMinus1Idx = dev14Logs.findIndex((l) => l.workDateOffsetDays === -1);
  if (devMinus1Idx !== -1) {
    dev14Logs[devMinus1Idx] = {
      username: 'demo_dev',
      taskKey: 'disaster-due-tomorrow',
      workDateOffsetDays: -1,
      hours: 12.0,
      note: 'Emergency boundary stress testing part 1 (12.0h)',
    };
  }

  return [
    {
      name: '[DEMO] Nepal Disaster Relief Portal',
      description:
        'Emergency response coordination platform for Nepal Red Cross and district authorities: <script>alert(1)</script> and <b>bold</b> testing (नेपाल विपद् व्यवस्थापन पोर्टल).\n\nDetailed multi-line project scope covering Melamchi corridor relief dispatch.',
      status: ProjectStatus.on_track,
      startDateOffsetDays: -30,
      targetDateOffsetDays: 60,
      creatorUsername: 'demo_pm',
      members: [
        { username: 'demo_pm', role: ProjectRole.manager },
        { username: 'demo_dev', role: ProjectRole.member, isFormerMember: true }, // Former member!
        { username: 'demo_designer', role: ProjectRole.member },
        { username: 'demo_viewer', role: ProjectRole.viewer }, // Project viewer!
      ],
      milestones: [
        {
          name: 'Phase 0 Reconnaissance & Archival',
          dueDateOffsetDays: -35,
          completedAtOffsetDays: -30, // Completed milestone!
        },
        {
          name: 'Phase 1 Requirements & Geo-Mapping',
          dueDateOffsetDays: -7, // Overdue incomplete milestone!
        },
        {
          name: 'Phase 2 SMS Broadcast & Relief Allocation',
          dueDateOffsetDays: 30, // Active milestone
        },
        {
          name: 'Phase 3 Post-Monsoon Impact Assessment',
          dueDateOffsetDays: 90, // Empty milestone (0 tasks attached!)
        },
      ],
      tasks: [
        // 1. Completed task (was due in past, now done -> not overdue!)
        {
          key: 'disaster-1',
          title: 'Setup Leaflet offline tile caching for rural districts',
          description: 'Enable IndexedDB tile storage for field tablets when internet connection is lost.',
          status: TaskStatus.done,
          assigneeUsername: 'demo_dev', // Former member assigned task!
          creatorUsername: 'demo_pm',
          milestoneName: 'Phase 0 Reconnaissance & Archival',
          estimatedHours: 16,
          dueDateOffsetDays: -30,
        },
        // 2. Real overdue task 30 days ago (status: todo, NOT done)
        {
          key: 'disaster-overdue-30',
          title: 'Satellite dish azimuth alignment calibration for Melamchi station',
          description: 'Re-align Ku-band dish reflector following windstorm telemetry alerts.',
          status: TaskStatus.todo,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'Phase 1 Requirements & Geo-Mapping',
          estimatedHours: 8.0,
          dueDateOffsetDays: -30, // REAL OVERDUE 30 DAYS!
        },
        // 3. Real overdue task 7 days ago (status: blocked, NOT done)
        {
          key: 'disaster-overdue-7',
          title: 'SMS delivery callback webhook verification',
          description: 'Implement HMAC webhook verifier for NTC and Ncell SMS gateway delivery reports.',
          status: TaskStatus.blocked,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'Phase 2 SMS Broadcast & Relief Allocation',
          estimatedHours: 12.0,
          dueDateOffsetDays: -7, // REAL OVERDUE 7 DAYS!
        },
        // 4. Real overdue task 1 day ago (status: in_progress, NOT done, without estimated hours, subtask!)
        {
          key: 'disaster-overdue-1',
          title: 'Export high-contrast color palette for field sunlight visibility',
          description: 'Ensure triage tags (Green, Yellow, Red, Black) pass WCAG AAA in bright outdoor glare.',
          status: TaskStatus.in_progress,
          assigneeUsername: 'demo_designer',
          creatorUsername: 'demo_pm',
          parentTaskKey: 'disaster-due-today', // Subtask!
          dueDateOffsetDays: -1, // REAL OVERDUE 1 DAY!
          // estimatedHours omitted: without estimated hours!
        },
        // 5. Due today (status: in_progress, NOT done)
        {
          key: 'disaster-due-today',
          title: 'Design mobile-responsive triage intake dashboard',
          description: 'Create user flow and high-fidelity mockups for field worker patient intake.',
          status: TaskStatus.in_progress,
          assigneeUsername: 'demo_designer',
          creatorUsername: 'demo_pm',
          milestoneName: 'Phase 1 Requirements & Geo-Mapping',
          estimatedHours: 20.0,
          dueDateOffsetDays: 0, // DUE TODAY!
        },
        // 6. Due tomorrow (exact 200-char title, ~5000-char description with raw bold and script)
        {
          key: 'disaster-due-tomorrow',
          title: DEMO_HOSTILE_TITLE_200, // Exact 200 chars!
          description: generateHostileMarkdown5000(), // ~5000 chars with raw <b>bold</b> and <script>alert(1)</script>!
          status: TaskStatus.in_progress,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'Phase 1 Requirements & Geo-Mapping',
          estimatedHours: 24.0,
          dueDateOffsetDays: 1, // DUE TOMORROW!
        },
        // 7. No due date, unassigned, without estimated hours, subtask
        {
          key: 'disaster-nodate-1',
          title: 'Triage field manual print layout preparation',
          description: 'High-contrast monochrome print layout for remote field posts without color printers.',
          status: TaskStatus.todo,
          creatorUsername: 'demo_pm',
          parentTaskKey: 'disaster-due-today', // Subtask 2!
          // assigneeUsername omitted: unassigned!
          // dueDateOffsetDays omitted: no due date!
          // estimatedHours omitted: without estimated hours!
        },
        // 8. Created by a MEMBER (not the manager!), Devanagari title, future due date (+14d)
        {
          key: 'disaster-member-created',
          title: 'नेपाल विपद् व्यवस्थापन पोर्टल: ग्रामीण क्षेत्रको लागि नक्सा क्यासिङ', // Devanagari title!
          description: 'Detailed specification for rural offline mapping tile packs.\nMulti-line requirements authored by design team.',
          status: TaskStatus.todo,
          assigneeUsername: 'demo_designer',
          creatorUsername: 'demo_designer', // CREATED BY MEMBER (demo_designer), NOT MANAGER (demo_pm)!
          milestoneName: 'Phase 2 SMS Broadcast & Relief Allocation',
          estimatedHours: 16.0,
          dueDateOffsetDays: 14, // REAL FUTURE DUE DATE!
        },
        // 9 to 59: Batch tasks to bring Project 1 tasks to >= 55 tasks (59 tasks total on Project 1!)
        ...generateDisasterBatchTasks(),
      ],
      dependencies: [
        // Chain of three: disaster-overdue-7 -> disaster-due-tomorrow -> disaster-1
        {
          taskKey: 'disaster-overdue-7',
          dependsOnTaskKey: 'disaster-due-tomorrow',
        },
        {
          taskKey: 'disaster-due-tomorrow',
          dependsOnTaskKey: 'disaster-1',
        },
        // One open prerequisite: disaster-overdue-1 depends on disaster-due-today (which is in_progress / open!)
        {
          taskKey: 'disaster-overdue-1',
          dependsOnTaskKey: 'disaster-due-today',
        },
      ],
      comments: [
        {
          taskKey: 'disaster-1',
          authorUsername: 'demo_dev', // Former member comment!
          body: 'Offline tile storage verified with IndexedDB fallback for remote health posts.',
        },
        {
          taskKey: 'disaster-due-tomorrow',
          authorUsername: 'demo_pm',
          body: 'Testing injection handling with raw <b>bold</b> formatting and unescaped script: <script>alert(1)</script>. Verify database stores string raw.',
        },
        {
          taskKey: 'disaster-overdue-7',
          authorUsername: 'demo_dev',
          body: 'Blocked pending API credentials from national telecommunications authority.',
        },
        {
          taskKey: 'disaster-due-today',
          authorUsername: 'demo_designer',
          body: 'Initial Figma responsive prototype completed for mobile and tablet breakpoints.',
        },
        {
          taskKey: 'disaster-overdue-1',
          authorUsername: 'demo_designer',
          body: 'High-contrast color palette reviewed against WCAG AAA standards in sunlight testing.',
        },
        {
          taskKey: 'disaster-nodate-1',
          authorUsername: 'demo_pm',
          body: 'Print manual layout draft sent to district coordination office for review.',
        },
        {
          taskKey: 'disaster-member-created',
          authorUsername: 'demo_designer',
          body: 'टिप्पणी: Melamchi क्षेत्रमा जलसतह सेन्सर परीक्षण सम्पन्न भयो। Devanagari text verified.', // Devanagari comment!
        },
      ],
      messages: [
        {
          authorUsername: 'demo_pm',
          body: 'Welcome team to the Nepal Disaster Relief Portal initiative.\n\nWeekly sync schedule:\n- Tuesdays at 10:00 AM NPT: Engineering sync\n- Thursdays at 2:00 PM NPT: Logistics & stakeholder alignment',
          isPinned: true, // Multi-line pinned message!
        },
        {
          authorUsername: 'demo_dev',
          body: 'Geo-spatial mapping server mock has been deployed locally for testing.',
          isPinned: false, // Former member message by demo_dev!
        },
        {
          authorUsername: 'demo_pm',
          body: 'परियोजना अद्यावधिक: मेलम्ची क्षेत्रमा बाढी पूर्वसूचना प्रणाली जडान कार्य जारी छ।',
          isPinned: false, // Devanagari message!
        },
        {
          authorUsername: 'demo_pm',
          body: 'Emergency helicopter landing coordinates confirmed for Chautara field hospital.',
          isPinned: true, // Second pinned message!
        },
        // 5 to 56: 52 additional messages bringing Project 1 messages to 56 messages (>= 55 for pagination!)
        ...generateDisasterBatchMessages(),
      ],
      timeLogs: [
        ...dev14Logs,
        ...designer14Logs,
        ...pm14Logs,
      ],
    },
    {
      name: '[DEMO] Valley Transit App',
      description: 'Real-time bus tracking and smart ticketing for Kathmandu Valley public transportation.',
      status: ProjectStatus.at_risk,
      startDateOffsetDays: -45,
      targetDateOffsetDays: 30,
      creatorUsername: 'demo_pm',
      statusEvents: [
        {
          fromStatus: ProjectStatus.on_track,
          toStatus: ProjectStatus.at_risk,
          reason: 'Third-party GPS telemetry feed from bus syndicate is experiencing intermittent latency.',
          changedByUsername: 'demo_pm',
        },
      ],
      members: [
        { username: 'demo_pm', role: ProjectRole.manager },
        { username: 'demo_dev', role: ProjectRole.member },
        // demo_designer is a NON-member of this project!
      ],
      milestones: [{ name: 'GTFS Feed Integration', dueDateOffsetDays: 20 }],
      tasks: [
        {
          key: 'transit-1',
          title: 'Parse live GTFS-RT protobuf feed from Ring Road routes',
          description: 'Ingest vehicle positions and trip updates into Redis geospatial indices.',
          status: TaskStatus.in_progress,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'GTFS Feed Integration',
          estimatedHours: 30.0,
          dueDateOffsetDays: 15,
        },
        {
          key: 'transit-2',
          title: 'Bus driver GPS transponder battery check script',
          description: 'Automate voltage monitoring alerts for low-power onboard transponders.',
          status: TaskStatus.todo,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          estimatedHours: 8.0,
          // dueDateOffsetDays omitted: no due date!
        },
        {
          key: 'transit-3',
          title: 'Validate Sajha Yatayat fare card NFC reader firmware',
          description: 'Test contactless Mifare Ultralight tap latency across 50 validators.',
          status: TaskStatus.todo,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'GTFS Feed Integration',
          estimatedHours: 14.0,
          dueDateOffsetDays: 25,
        },
      ],
      dependencies: [],
      comments: [
        {
          taskKey: 'transit-1',
          authorUsername: 'demo_dev',
          body: 'Protobuf schema parsed; testing rate-limits with 200 concurrent bus beacons.',
        },
      ],
      messages: [
        {
          authorUsername: 'demo_pm',
          body: 'Transit committee approved the open data trial for Sajha Yatayat buses.',
          isPinned: true, // Pinned message 1 among other projects!
        },
        {
          authorUsername: 'demo_dev',
          body: 'GPS transponder testing scheduled on Route 4 tomorrow morning.',
          isPinned: false,
        },
        {
          authorUsername: 'demo_pm',
          body: 'Municipal transit data sharing agreement draft received from ministry.',
          isPinned: false,
        },
      ],
      timeLogs: [
        // Part 2 of near-24h day for demo_dev on offset -1 (11.0h, combined with 12.0h on Project 1 = 23.0h total!)
        {
          username: 'demo_dev',
          taskKey: 'transit-1',
          workDateOffsetDays: -1,
          hours: 11.0,
          note: 'Emergency telemetry stress testing part 2 (11.0h, daily total 23.0h)',
        },
      ],
    },
    {
      name: '[DEMO] Heritage Preservation Archive',
      description: 'Digitization and 3D photogrammetry indexing for UNESCO heritage monuments in Bhaktapur and Patan.',
      status: ProjectStatus.complete,
      startDateOffsetDays: -90,
      targetDateOffsetDays: -10,
      creatorUsername: 'demo_pm',
      statusEvents: [
        {
          fromStatus: ProjectStatus.on_track,
          toStatus: ProjectStatus.complete,
          reason: 'All 120 monument scans cataloged, validated, and archived with Department of Archaeology.',
          changedByUsername: 'demo_pm',
        },
      ],
      members: [
        { username: 'demo_pm', role: ProjectRole.manager },
        { username: 'demo_designer', role: ProjectRole.member },
        // demo_dev is a NON-member of this project!
      ],
      milestones: [
        {
          name: 'Photogrammetry Verification',
          dueDateOffsetDays: -15,
          completedAtOffsetDays: -12, // Completed milestone!
        },
      ],
      tasks: [
        {
          key: 'heritage-1',
          title: 'High-resolution archival metadata verification',
          description: 'Verify Dublin Core metadata schemas for 120 stone inscriptions and wood carvings.',
          status: TaskStatus.done,
          assigneeUsername: 'demo_designer',
          creatorUsername: 'demo_pm',
          milestoneName: 'Photogrammetry Verification',
          estimatedHours: 40.0,
          dueDateOffsetDays: -12, // Completed task, due 12 days ago in past!
        },
        {
          key: 'heritage-2',
          title: 'Archival photogrammetry point-cloud noise reduction',
          description: 'Clean LiDAR point clouds for Patan Krishna Mandir stone relief carvings.',
          status: TaskStatus.done,
          assigneeUsername: 'demo_designer',
          creatorUsername: 'demo_pm',
          milestoneName: 'Photogrammetry Verification',
          estimatedHours: 25.0,
          dueDateOffsetDays: -14,
        },
      ],
      dependencies: [],
      comments: [
        {
          taskKey: 'heritage-1',
          authorUsername: 'demo_designer',
          body: 'Archaeology department has stamped digital certificate of provenance.',
        },
      ],
      messages: [
        {
          authorUsername: 'demo_pm',
          body: 'Project sign-off complete. Excellent archival precision by the design team.',
          isPinned: true, // Pinned message 2 among other projects!
        },
        {
          authorUsername: 'demo_designer',
          body: 'Final photogrammetry render files uploaded to Department of Archaeology cloud vault.',
          isPinned: false,
        },
        {
          authorUsername: 'demo_pm',
          body: 'Press release scheduled for national heritage preservation week.',
          isPinned: false,
        },
      ],
      timeLogs: [],
    },
    {
      name: '[DEMO] Solar Grid Micro-Management',
      description: 'Decentralized solar microgrid metering and billing telemetry for off-grid communities.',
      status: ProjectStatus.on_hold,
      startDateOffsetDays: -20,
      targetDateOffsetDays: 90,
      creatorUsername: 'demo_pm',
      statusEvents: [
        {
          fromStatus: ProjectStatus.on_track,
          toStatus: ProjectStatus.on_hold,
          reason: 'Awaiting regulatory clearance and tariff structure approval from AEPC.',
          changedByUsername: 'demo_pm',
        },
      ],
      members: [
        { username: 'demo_pm', role: ProjectRole.manager },
        { username: 'demo_dev', role: ProjectRole.member },
        // demo_designer is a NON-member of this project!
      ],
      milestones: [{ name: 'Microgrid Telemetry Ingestion Spec', dueDateOffsetDays: 30 }],
      tasks: [
        {
          key: 'solar-1',
          title: 'Draft smart meter MQTT ingestion protocol specification',
          description: 'Document TLS client certificate authentication and power quality telemetry schema.',
          status: TaskStatus.blocked, // Blocked task!
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          milestoneName: 'Microgrid Telemetry Ingestion Spec',
          estimatedHours: 15.0,
          dueDateOffsetDays: 20,
        },
        {
          key: 'solar-2',
          title: 'Solar battery discharge cycle degradation simulation',
          description: 'Run mathematical model on LiFePO4 battery storage longevity in Himalayan winter.',
          status: TaskStatus.todo,
          assigneeUsername: 'demo_dev',
          creatorUsername: 'demo_pm',
          estimatedHours: 20.0,
          dueDateOffsetDays: 45,
        },
      ],
      dependencies: [],
      comments: [
        {
          taskKey: 'solar-1',
          authorUsername: 'demo_dev',
          body: 'Holding technical spec until ministerial guidelines on rural micro-tariffs are published.',
        },
      ],
      messages: [
        {
          authorUsername: 'demo_pm',
          body: 'Project on hold pending AEPC meeting next month.',
          isPinned: false,
        },
        {
          authorUsername: 'demo_dev',
          body: 'Reviewed preliminary microgrid battery safety standards.',
          isPinned: false,
        },
      ],
      timeLogs: [],
    },
  ];
}

export interface DemoWorkLogDayDef {
  username: string;
  dateOffsetDays: number;
  status: WorkLogStatus;
  submittedAtOffsetDays?: number;
  approvedAtOffsetDays?: number;
  approvedByUsername?: string;
  rejectionReason?: string;
  entries: Array<{
    workRoleName: string;
    hours: number;
    description: string;
    linkProjectName?: string;
    linkTaskKey?: string;
  }>;
}

// Exactly 10 days of work logs each for demo_dev and demo_designer (offsets -10 to -1) in mixed statuses
export function getDemoWorkLogs(): DemoWorkLogDayDef[] {
  return [
    // --- DEMO_DEV (10 DAYS: offsets -10 to -1) ---
    {
      username: 'demo_dev',
      dateOffsetDays: -10,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -10,
      approvedAtOffsetDays: -9,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 8.0,
          description: 'Architecture review for offline telemetry data stores',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -9,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -9,
      approvedAtOffsetDays: -8,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 8.0,
          description: 'API gateway routing configuration and benchmark tests',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -8,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -8,
      approvedAtOffsetDays: -7,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'Automated test suite execution for authentication services',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -7,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -7,
      approvedAtOffsetDays: -6,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 8.0,
          description: 'Database index tuning for high-concurrency log queries',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -6,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -6,
      approvedAtOffsetDays: -5,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'Load testing with 500 simulated concurrent telemetry sockets',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -5,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -5,
      approvedAtOffsetDays: -4,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 8.0,
          description: 'Redis cluster configuration for geospatial bus tracking',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -4,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -4,
      approvedAtOffsetDays: -3,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'End-to-end regression testing on project message endpoints',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -3,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -3,
      approvedAtOffsetDays: -2,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 4.0,
          description: 'Transit App GTFS real-time telemetry decoder tuning',
          linkProjectName: '[DEMO] Valley Transit App',
          linkTaskKey: 'transit-1', // Linked Entry 1
        },
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 4.0,
          description: 'Transit App GPS transponder battery diagnostic script',
          linkProjectName: '[DEMO] Valley Transit App',
          linkTaskKey: 'transit-2', // Linked Entry 2 (owner demo_dev is current member)
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -2,
      status: WorkLogStatus.submitted,
      submittedAtOffsetDays: -2,
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 5.0,
          description: 'Solar Grid smart meter MQTT ingestion schema validation',
          linkProjectName: '[DEMO] Solar Grid Micro-Management',
          linkTaskKey: 'solar-1', // Linked Entry 3 (owner demo_dev is current member)
        },
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 3.0,
          description: 'Code review and unit test run across API gateway modules',
        },
      ],
    },
    {
      username: 'demo_dev',
      dateOffsetDays: -1,
      status: WorkLogStatus.rejected,
      submittedAtOffsetDays: -1,
      rejectionReason: 'Shift notes missing ticket references; please amend and resubmit.',
      entries: [
        {
          workRoleName: '[DEMO] Full Stack Engineering',
          hours: 8.0,
          description: 'Emergency patch testing on disaster relief server',
        },
      ],
    },

    // --- DEMO_DESIGNER (10 DAYS: offsets -10 to -1) ---
    {
      username: 'demo_designer',
      dateOffsetDays: -10,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -10,
      approvedAtOffsetDays: -9,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Design system typography scale and line height adjustments',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -9,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -9,
      approvedAtOffsetDays: -8,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Accessibility contrast verification on button and input states',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -8,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -8,
      approvedAtOffsetDays: -7,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'Screen reader usability walk-through on registration flow',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -7,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -7,
      approvedAtOffsetDays: -6,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Prototyping responsive navigation drawer for tablet viewports',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -6,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -6,
      approvedAtOffsetDays: -5,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'Auditing modal focus traps and keyboard navigation shortcuts',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -5,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -5,
      approvedAtOffsetDays: -4,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Iconography asset optimization and SVG cleanup',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -4,
      status: WorkLogStatus.approved,
      submittedAtOffsetDays: -4,
      approvedAtOffsetDays: -3,
      approvedByUsername: 'demo_pm',
      entries: [
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 8.0,
          description: 'Cross-browser rendering tests on Firefox and Safari',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -3,
      status: WorkLogStatus.submitted,
      submittedAtOffsetDays: -3,
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Drafting mobile patient triage user flows',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -2,
      status: WorkLogStatus.rejected,
      submittedAtOffsetDays: -2,
      rejectionReason: 'Incomplete description of wireframe components.',
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 8.0,
          description: 'Wireframing triage components',
        },
      ],
    },
    {
      username: 'demo_designer',
      dateOffsetDays: -1,
      status: WorkLogStatus.draft,
      entries: [
        {
          workRoleName: '[DEMO] UI/UX Design',
          hours: 6.0,
          description: 'Wireframes and user journeys for disaster relief mobile triage intake',
          linkProjectName: '[DEMO] Nepal Disaster Relief Portal',
          linkTaskKey: 'disaster-due-today', // Linked Entry 4
        },
        {
          workRoleName: '[DEMO] Quality Assurance & Testing',
          hours: 2.0,
          description: 'Auditing high-contrast triage tags against WCAG AAA standards',
        },
      ],
    },
  ];
}

export const DEMO_PROJECTS = getDemoProjects();
export const DEMO_WORK_LOG_DAYS = getDemoWorkLogs();

