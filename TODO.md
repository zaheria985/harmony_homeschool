# Harmony Homeschool - TODO & Backlog

## In Progress - Major Features

### Multi-View Lesson System (#233-240)
- [ ] Add missing fields to database schema (#233)
  - Curricula: cover_image, status, start_date, end_date, notes
  - Lessons: cover_image, estimated_duration, notes
  - Resources: Global library table
- [ ] Create resources library and management (#234)
  - app/resources/page.tsx (searchable table/gallery)
  - app/resources/[id]/page.tsx (detail page showing usage)
  - Resource-to-lesson linking (two-way)
- [ ] Implement editable lessons table with bulk operations (#235)
  - Table view with inline editing (TanStack Table)
  - Bulk paste lesson titles
  - Bulk resource attachment
  - Keyboard navigation
- [ ] Enhanced lesson detail pages (#236)
  - Card-style layout
  - Resource cards with thumbnails
  - Inherited vs lesson-specific resources
- [ ] Curriculum detail page enhancements (#237)
  - Visual card layout
  - Shared resources section
  - Lessons list with thumbnails
- [ ] Add view toggles throughout app (#238)
  - Lessons: Table ↔ Kanban toggle
  - Curricula: Table ↔ Gallery toggle
  - Resources: Table ↔ Gallery toggle

## Planned Features

- [ ] Attendance tracking module (#1)
- [ ] Report card PDF export (#2)
- [ ] Calendar view improvements (#3)
- [ ] Advanced search/filter for lessons (#4)
- [ ] Parent-child user switching (#5)
- [ ] Mobile responsive improvements (#6)
- [ ] Lesson detail page: Main card + resource cards (#204)
- [ ] Resource cards: Embedded previews (YouTube thumbnails, PDF icons) (#205)
- [ ] Lesson page: Activity timeline (#206)

## Week Planner Redesign (Completed ✓)

- [x] Show Mon-Sun grid instead of just school days (#200)
- [x] Week view: Show subject headers with lesson titles per day (#201)
- [x] Day modal: 80-90% width, shows subjects grouped with lessons (#202)
- [x] Make lessons clickable → navigate to /lessons/[id] (#203)

## Known Issues

- [ ] Week planner performance with 500+ lessons (#101)
- [ ] Grade input validation needs tightening (#102)
- [ ] Calendar modal doesn't close on mobile (#103)

## Technical Debt

- [ ] Add error boundaries to client components
- [ ] Consider migration to Drizzle ORM
- [ ] Add integration tests for critical flows
- [ ] Implement proper error logging
- [ ] Add loading states to all mutations

## Completed

- [x] Initial app structure and database schema
- [x] Week planner with 3-level drill-down
- [x] Lesson Kanban board
- [x] Grade tracking and summaries
- [x] MCP server for Claude Code integration
- [x] Mon-Sun week grid view
- [x] Day modal with grouped subjects
- [x] Clickable lessons navigating to detail pages
- [x] Admin section with CRUD for children, subjects, curricula (#210-215)
- [x] Lesson creation and editing forms (#210-212)
- [x] Student and subject management forms (#213-214)
