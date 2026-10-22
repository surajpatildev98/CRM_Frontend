import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import {
  apiCatalog, apiRequest, asRows, endpoints, field, isObject, JsonObject, label, loadAnnouncements, API_BASE,
  loadAttendance, loadDashboard, loadEmployees, loadLeads, loadLeaveData, loadMasterData,
  loadOpportunities, loadTickets, text, unwrap, loadLeadDetails, loadLeadMasterData, loadStates, loadCities, loadOfferings, loadProducts, registerLead, withQuery,
} from './api'
import { clearSession, readSession, saveSession, Session } from './session'
import LoginPage from './components/Login/LoginPage'

type Page = 'dashboard' | 'lead-all' | 'lead-create' | 'lead-my' | 'lead-assigned' | 'lead-unassigned' | 'lead-detail' | 'opportunities' | 'employees' | 'attendance' | 'leave' | 'tickets' | 'announcements' | 'master-data' | 'api-console'
type User = JsonObject
const TOKEN_KEY = 'crm.frontend.token'
const USER_KEY = 'crm.frontend.user'

const navigation: Array<{ id: Page; label: string; icon: string; group: string }> = [
  { id: 'dashboard', label: 'Overview', icon: '⌂', group: 'Workspace' },
  { id: 'opportunities', label: 'Opportunities', icon: '◇', group: 'Sales' },
  { id: 'employees', label: 'Employees', icon: '◎', group: 'People' },
  { id: 'attendance', label: 'Attendance', icon: '◷', group: 'People' },
  { id: 'leave', label: 'Leave', icon: '▣', group: 'People' },
  { id: 'tickets', label: 'Tickets', icon: '□', group: 'Operations' },
  { id: 'announcements', label: 'Announcements', icon: '◉', group: 'Operations' },
  { id: 'master-data', label: 'Master data', icon: '▦', group: 'Administration' },
  { id: 'api-console', label: 'API console', icon: '{ }', group: 'Administration' },
]

const leadItems: Array<{ id: Page; label: string }> = [
  { id: 'lead-all', label: 'All Leads' }, { id: 'lead-create', label: 'Create Lead' }, { id: 'lead-my', label: 'My Leads' }, { id: 'lead-assigned', label: 'Assigned Leads' }, { id: 'lead-unassigned', label: 'Unassigned Leads' },
]

function readUser(): User {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}') as User } catch { return {} }
}

function value(row: JsonObject, ...keys: string[]) {
  const found = Object.keys(row).find((candidate) => keys.some((key) => candidate.toLowerCase() === key.toLowerCase()))
  return text(found ? row[found] : undefined)
}

function Shell({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [page, setPage] = useState<Page>('dashboard')
  const [leadOpen, setLeadOpen] = useState(true)
  const [opportunityOpen, setOpportunityOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | number | undefined>()
  const firstName = value(user, 'firstName') === '—' ? 'User' : value(user, 'firstName')
  const groups = [...new Set(navigation.map((item) => item.group))]
   return <div className="shell"><aside className="sidebar"><div className="side-brand"><div className="logo">RK</div><div><strong>Rajkamal</strong><span>CRM workspace</span></div></div><nav>{groups.map((group) => <div className="nav-group" key={group}><span className="nav-caption">{group}</span>{group === 'Sales' && <><button className="nav-item nav-group-toggle" onClick={() => setLeadOpen(!leadOpen)}><i>↗</i>Lead Operations <span className="chevron">{leadOpen ? '⌃' : '⌄'}</span></button>{leadOpen && <div className="nav-submenu">{leadItems.map((item) => <button className={page === item.id ? 'nav-item active' : 'nav-item'} key={item.id} onClick={() => setPage(item.id)}>{item.label}</button>)}</div>}<button className="nav-item nav-group-toggle" onClick={() => setOpportunityOpen(!opportunityOpen)}><i>◇</i>Opportunity <span className="chevron">{opportunityOpen ? '⌃' : '⌄'}</span></button>{opportunityOpen && <button className={page === 'opportunities' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('opportunities')}>All Opportunities</button>}</>}{group !== 'Sales' && navigation.filter((item) => item.group === group).map((item) => <button className={page === item.id ? 'nav-item active' : 'nav-item'} key={item.id} onClick={() => setPage(item.id)}><i>{item.icon}</i>{item.label}</button>)}</div>)}</nav><div className="side-footer"><span className="online-dot" /> API connected<div className="api-url">{API_BASE.replace(/^https?:\/\//, '')}</div></div></aside><div className="content"><header className="topbar"><div><span className="mobile-title">Rajkamal CRM</span><span className="breadcrumb">Workspace / <b>{leadItems.find((item) => item.id === page)?.label || navigation.find((item) => item.id === page)?.label || 'Lead details'}</b></span></div><div className="profile"><div className="avatar">{firstName.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><b>{firstName}</b><span>{value(user, 'employeeCode')}</span></div><button className="logout" onClick={onLogout}>Log out</button></div></header><main className="main"><PageView page={page} token={token} user={user} detailId={detailId} onNavigate={(next, id) => { setDetailId(id); setPage(next) }} /></main></div></div>
}

function PageView({ page, token, user, detailId, onNavigate }: { page: Page; token: string; user: User; detailId?: string | number; onNavigate: (page: Page, id?: string | number) => void }) {
  if (page === 'dashboard') return <DashboardPage token={token} user={user} />
  if (page === 'lead-create') return <CreateLeadPage token={token} onDone={() => onNavigate('lead-all')} />
  if (page === 'lead-detail') return <LeadDetailPage token={token} leadId={detailId} onBack={() => onNavigate('lead-all')} />
  if (page.startsWith('lead-')) return <AllLeadsPage token={token} mode={page} onView={(id) => onNavigate('lead-detail', id)} />
  if (page === 'leave') return <LeavePage token={token} user={user} />
  if (page === 'master-data') return <MasterDataPage token={token} />
  if (page === 'api-console') return <ApiConsole token={token} />
  const config: Record<Exclude<Page, 'dashboard' | 'leave' | 'master-data' | 'api-console' | 'attendance' | 'lead-all' | 'lead-create' | 'lead-my' | 'lead-assigned' | 'lead-unassigned' | 'lead-detail'>, { title: string; description: string; load: (token: string) => Promise<JsonObject[]>; columns: Array<[string, string[]]>; action?: string }> = {
    opportunities: { title: 'Opportunities', description: 'Monitor the pipeline and active opportunities.', load: loadOpportunities, columns: [['Opportunity', ['opportunityName', 'name', 'title']], ['Customer', ['customerName', 'companyName']], ['Stage', ['stageName', 'stage']], ['Value', ['amount', 'value', 'totalAmount']]], action: 'Opportunity details' },
    employees: { title: 'Employees', description: 'Browse employee records returned by the Employee API.', load: loadEmployees, columns: [['Employee', ['employeeName', 'firstName', 'name']], ['Code', ['employeeCode', 'code']], ['Department', ['departmentName', 'department']], ['Role', ['roleName', 'role']]], action: 'Employee details' },
    tickets: { title: 'Tickets', description: 'View and manage service tickets in one place.', load: loadTickets, columns: [['Ticket', ['ticketNo', 'ticketNumber', 'title', 'subject']], ['Customer', ['customerName', 'companyName']], ['Status', ['statusName', 'status']], ['Priority', ['priorityName', 'priority']]], action: 'Ticket details' },
    announcements: { title: 'Announcements', description: 'Keep your team informed with CRM announcements.', load: loadAnnouncements, columns: [['Title', ['title', 'subject', 'announcementTitle']], ['Audience', ['audience', 'targetType']], ['Created', ['createdOn', 'createdDate']], ['Status', ['status', 'statusName']]], action: 'Announcement details' },
  }
  if (page === 'attendance') return <AttendancePage token={token} />
  const current = config[page as keyof typeof config]
  return <DataPage {...current} token={token} />
}

function PageHeader({ eyebrow = 'CRM workspace', title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><p className="kicker">{eyebrow}</p><h1>{title}</h1><p className="subtle">{description}</p></div>{action}</div>
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="alert error"><b>Could not load this page.</b><span>{message}</span>{retry && <button className="button ghost" onClick={retry}>Try again</button>}</div>
}

function LoadingState() { return <div className="loading"><span className="spinner" /> Loading data from the CRM API…</div> }

function DashboardPage({ token, user }: { token: string; user: User }) {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = () => { setLoading(true); setError(''); loadDashboard(token).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Dashboard request failed.')).finally(() => setLoading(false)) }
  useEffect(refresh, [token])
  const object = isObject(data) ? data : {}
  const kpi = isObject(field(object, 'kpi')) ? field(object, 'kpi') as JsonObject : object
  const name = text(field(user, 'firstName'), 'there')
  const leadRows = asRows(field(object, 'leadFunnel'))
  const opportunityRows = asRows(field(object, 'opportunityPipeline'))
  const leadChart = leadRows.map((row) => ({ name: text(field(row, 'statusName'), 'Unknown'), value: Number(field(row, 'leadCount')) || 0 }))
  const opportunityChart = opportunityRows.map((row) => ({ name: text(field(row, 'stageName'), 'Unknown'), value: Number(field(row, 'totalRevenue')) || 0 }))
  const metrics: Array<[string, string, string]> = [
    ['Total leads', text(field(kpi, 'totalLeads'), '0'), 'All leads in your scope'],
    ['Customers', text(field(kpi, 'totalCustomers'), '0'), 'Total CRM customers'],
    ['Open opportunities', text(field(kpi, 'openOpportunities'), '0'), 'Currently active'],
    ['Pipeline value', `₹${text(field(kpi, 'pipelineValue'), '0.00')}`, 'Total opportunity revenue'],
    ['Qualified leads', text(field(kpi, 'qualifiedLeads'), '0'), 'Ready for conversion'],
    ['Unassigned leads', text(field(kpi, 'unassignedLeads'), '0'), 'Need an owner'],
  ]
  return <><PageHeader eyebrow="Good to see you" title={`Hello, ${name}`} description="Your personal CRM snapshot, live from the dashboard API." action={<button className="button ghost" onClick={refresh}>↻ Refresh</button>} />{loading && <LoadingState />}{error && <ErrorState message={error} retry={refresh} />}{!loading && !error && <><div className="metric-grid">{metrics.map(([title, value, note]) => <div className="metric-card" key={title}><span>{title}</span><strong>{value}</strong><small>{note}</small></div>)}</div><div className="chart-grid"><ChartCard title="Lead funnel" subtitle="Lead count by status" data={leadChart} emptyMessage="No leads are available for the selected scope." /><ChartCard title="Opportunity pipeline" subtitle="Revenue by opportunity stage" data={opportunityChart} currency emptyMessage="No opportunity revenue is available yet." /></div><div className="dashboard-grid"><DashboardList title="Pending tasks" rows={asRows(field(object, 'pendingTasks'))} keys={['title', 'subject', 'dueDate', 'status']} /><DashboardList title="Recent activity" rows={asRows(field(object, 'recentActivity'))} keys={['subject', 'activityName', 'activityDateTime', 'employeeName']} /></div></>}</>}

const chartColors = ['#168e8a', '#2f6f9f', '#f0a04b', '#9b6cc7', '#df6f63', '#5b9b70', '#d05a91', '#61758a', '#d0bd58', '#4d9aa8', '#8d6e63', '#6a75c2', '#a65c5c']

function ChartCard({ title, subtitle, data, currency = false, emptyMessage }: { title: string; subtitle: string; data: Array<{ name: string; value: number }>; currency?: boolean; emptyMessage: string }) {
  const hasValues = data.some((item) => item.value > 0)
  return <section className="chart-card"><div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div></div>{hasValues ? <div className="chart-body"><ResponsiveContainer width="48%" height={240}><PieChart><Pie data={data.filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3}>{data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => currency ? [`₹${Number(value).toLocaleString()}`, 'Revenue'] : [value, 'Leads']} /></PieChart></ResponsiveContainer><div className="chart-legend">{data.map((item, index) => <div className="legend-row" key={item.name}><span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} /><span>{item.name}</span><b>{currency ? `₹${item.value.toLocaleString()}` : item.value}</b></div>)}</div></div> : <div className="chart-empty">{emptyMessage}<small>The chart will appear automatically when the API returns values.</small></div>}</section>
}

function DashboardList({ title, rows, keys }: { title: string; rows: JsonObject[]; keys: string[] }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2><span>{rows.length}</span></div>{rows.length ? <div className="compact-list">{rows.slice(0, 5).map((row, index) => <div className="compact-row" key={index}><b>{text(field(row, ...keys.slice(0, 2)), 'Item')}</b><span>{text(field(row, ...keys.slice(2)))}</span></div>)}</div> : <p className="empty-copy">No records returned.</p>}</section>
}

type DataPageProps = { token: string; title: string; description: string; load: (token: string) => Promise<JsonObject[]>; columns: Array<[string, string[]]>; action?: string }
function DataPage({ token, title, description, load, columns, action }: DataPageProps) {
  const [rows, setRows] = useState<JsonObject[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = () => { setLoading(true); setError(''); load(token).then(setRows).catch((caught) => setError(caught instanceof Error ? caught.message : 'Request failed.')).finally(() => setLoading(false)) }
  useEffect(refresh, [token, load])
  return <><PageHeader title={title} description={description} action={<button className="button ghost" onClick={refresh}>↻ Refresh</button>} />{loading && <LoadingState />}{error && <ErrorState message={error} retry={refresh} />}{!loading && !error && <section className="table-panel"><div className="table-toolbar"><div><b>{rows.length} records</b><span>Live API data</span></div>{action && <button className="button primary" onClick={() => alert(`Use API console for ${action} until the request fields are configured.`)}>+ {action}</button>}</div>{rows.length ? <div className="table-scroll"><table><thead><tr>{columns.map(([heading]) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([heading, keys]) => <td key={heading}>{text(field(row, ...keys))}</td>)}</tr>)}</tbody></table></div> : <div className="empty">No records were returned for your account.</div>}</section>}</> 
}

function optionId(row: JsonObject) { return text(field(row, 'id', 'value', 'employeeId', 'countryId', 'stateId', 'cityId', 'leadSourceId', 'designationId', 'categoryId', 'offeringId', 'productId', 'unitId'), '') }
function optionLabel(row: JsonObject) { return text(field(row, 'name', 'label', 'title', 'displayName', 'employeeName', 'countryName', 'stateName', 'cityName', 'leadSourceName', 'designationName', 'categoryName', 'offeringName', 'productName', 'unitName'), 'Select') }
function pick(row: JsonObject, ...keys: string[]) { return text(field(row, ...keys), '') }
type LeadBundle = JsonObject & { lead?: JsonObject; contacts?: JsonObject[]; requirements?: JsonObject[]; activities?: JsonObject[]; files?: JsonObject[]; followUps?: JsonObject[] }

function AllLeadsPage({ token, mode, onView }: { token: string; mode: Page; onView: (id: string) => void }) {
  const [rows, setRows] = useState<LeadBundle[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [assigned, setAssigned] = useState(''); const [employees, setEmployees] = useState<JsonObject[]>([])
  const query = () => ({ searchText: search, filterStatusId: status, filterAssignedToId: assigned, showCreatedAndAssigned: mode === 'lead-my' || mode === 'lead-assigned' })
  const load = () => { setLoading(true); setError(''); loadLeadDetails(token, query()).then((data) => setRows(data as LeadBundle[])).catch((e) => setError(e instanceof Error ? e.message : 'Lead request failed.')).finally(() => setLoading(false)) }
  useEffect(() => { loadLeadMasterData(token).then((data) => setEmployees(data.employees)).catch(() => undefined); load() }, [token, mode])
  const title = mode === 'lead-my' ? 'My Leads' : mode === 'lead-assigned' ? 'Assigned Leads' : mode === 'lead-unassigned' ? 'Unassigned Leads' : 'All Leads'
  return <><PageHeader title={title} description="Search, review, and operate your lead pipeline." action={<button className="button ghost" onClick={load}>↻ Refresh</button>} /><form className="filter-bar" onSubmit={(e) => { e.preventDefault(); load() }}><label>Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Company, contact, or lead" /></label><label>Assigned to<select value={assigned} onChange={(e) => setAssigned(e.target.value)}><option value="">Everyone</option>{employees.map((row, i) => <option key={i} value={optionId(row)}>{optionLabel(row)}</option>)}</select></label><button className="button primary" disabled={loading}>{loading ? 'Searching…' : 'Search leads'}</button></form>{loading && <LoadingState />}{error && <ErrorState message={error} retry={load} />}{!loading && !error && <section className="table-panel"><div className="table-toolbar"><div><b>{rows.length} leads</b><span>GET /api/Lead/Details</span></div></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Company</th><th>Contact</th><th>Status</th><th>Owner</th><th>Next follow-up</th><th /></tr></thead><tbody>{rows.map((bundle, i) => { const lead = isObject(bundle.lead) ? bundle.lead : bundle; const id = pick(lead, 'leadId', 'id', 'refLeadId'); return <tr key={i}><td><b>{pick(lead, 'customerName', 'companyName', 'leadName')}</b><small className="table-meta">{pick(lead, 'cityName', 'address')}</small></td><td>{pick((bundle.contacts || [])[0] || {}, 'contactPerson', 'name')}<small className="table-meta">{pick((bundle.contacts || [])[0] || {}, 'mobile', 'email')}</small></td><td><span className="status-pill">{pick(lead, 'statusName', 'leadStatus', 'status')}</span></td><td>{pick(lead, 'assignedToName', 'employeeName', 'assignedTo')}</td><td>{pick((bundle.followUps || [])[0] || {}, 'nextFollowUpDate', 'scheduledOn')}</td><td><button className="button ghost small" onClick={() => onView(id)}>View</button></td></tr> })}</tbody></table></div> : <div className="empty">No leads match your search.</div>}</section>}</>
}

function LeadDetailPage({ token, leadId, onBack }: { token: string; leadId?: string | number; onBack: () => void }) {
  const [bundle, setBundle] = useState<LeadBundle | null>(null); const [tab, setTab] = useState('Overview'); const [error, setError] = useState('');
  useEffect(() => { if (!leadId) return; loadLeadDetails(token, { leadId }).then((rows) => setBundle((rows[0] || {}) as LeadBundle)).catch((e) => setError(e instanceof Error ? e.message : 'Lead detail request failed.')) }, [token, leadId])
  if (error) return <><PageHeader title="Lead details" description="" action={<button className="button ghost" onClick={onBack}>← Back</button>} /><ErrorState message={error} /></>
  if (!bundle) return <LoadingState />
  const lead = isObject(bundle.lead) ? bundle.lead : bundle; const collections: Record<string, JsonObject[]> = { Contacts: bundle.contacts || [], Requirements: bundle.requirements || [], Activities: bundle.activities || [], 'Follow-ups': bundle.followUps || [], Timeline: [...(bundle.activities || []), ...(bundle.followUps || [])] }
  const rows = collections[tab] || []
  return <><PageHeader title={pick(lead, 'customerName', 'companyName', 'leadName') || 'Lead details'} description={`${pick(lead, 'statusName', 'leadStatus', 'status')} · ${pick(lead, 'assignedToName', 'employeeName', 'assignedTo')}`} action={<button className="button ghost" onClick={onBack}>← Back to leads</button>} /><div className="tabs">{['Overview', 'Contacts', 'Requirements', 'Activities', 'Follow-ups', 'Timeline'].map((name) => <button className={tab === name ? 'tab active' : 'tab'} key={name} onClick={() => setTab(name)}>{name}</button>)}</div>{tab === 'Overview' ? <div className="detail-grid">{Object.entries(lead).filter(([, v]) => typeof v !== 'object').slice(0, 12).map(([key, val]) => <div className="detail-field" key={key}><small>{label(key)}</small><b>{text(val)}</b></div>)}</div> : <section className="panel"><div className="panel-title"><h2>{tab}</h2><span>{rows.length}</span></div>{rows.length ? <div className="detail-list">{rows.map((row, i) => <div className="detail-row" key={i}>{Object.entries(row).slice(0, 5).map(([key, val]) => <span key={key}><small>{label(key)}</small>{text(val)}</span>)}</div>)}</div> : <div className="empty">No {tab.toLowerCase()} were returned.</div>}</section>}</>
}

function CreateLeadPage({ token, onDone }: { token: string; onDone: () => void }) {
  const [master, setMaster] = useState<Record<string, JsonObject[]>>({}); const [states, setStates] = useState<JsonObject[]>([]); const [cities, setCities] = useState<JsonObject[]>([]); const [offerings, setOfferingsState] = useState<JsonObject[]>([]); const [products, setProductsState] = useState<JsonObject[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [form, setForm] = useState<Record<string, string>>({}); const [contact, setContact] = useState({ ContactPerson: '', Mobile: '', Email: '', Ref_DesignationId: '' }); const [reqs, setReqs] = useState([{ Ref_ProductCategoryId: '', Ref_OfferingId: '', Ref_ProductId: '', Quantity: '1', Ref_UnitId: '', RequirementRemark: '' }])
  useEffect(() => { loadLeadMasterData(token).then(setMaster).catch((e) => setError(e instanceof Error ? e.message : 'Could not load lead form data.')) }, [token])
  const set = (key: string, val: string) => setForm((old) => ({ ...old, [key]: val })); const id = (key: string) => form[key] || undefined
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); setSuccess(''); try { await registerLead(token, { CustomerName: form.CustomerName, Address: form.Address, Ref_CountryId: id('Ref_CountryId') ? Number(id('Ref_CountryId')) : null, Ref_StateId: id('Ref_StateId') ? Number(id('Ref_StateId')) : null, Ref_CityId: id('Ref_CityId') ? Number(id('Ref_CityId')) : null, PinCode: form.PinCode, Gst: form.Gst, Pan: form.Pan, Contacts: [{ ...contact, Ref_DesignationId: contact.Ref_DesignationId ? Number(contact.Ref_DesignationId) : null }], Requirement: form.Requirement, Ref_LeadSourceId: Number(form.Ref_LeadSourceId), LeadRemark: form.LeadRemark, AssignedToEmployeeId: id('AssignedToEmployeeId') ? Number(id('AssignedToEmployeeId')) : null, Requirements: reqs.map((r) => ({ ...r, Ref_ProductCategoryId: r.Ref_ProductCategoryId ? Number(r.Ref_ProductCategoryId) : null, Ref_OfferingId: r.Ref_OfferingId ? Number(r.Ref_OfferingId) : null, Ref_ProductId: r.Ref_ProductId ? Number(r.Ref_ProductId) : null, Ref_UnitId: r.Ref_UnitId ? Number(r.Ref_UnitId) : null, Quantity: Number(r.Quantity) })) }); setSuccess('Lead created successfully.'); setTimeout(onDone, 700) } catch (e) { setError(e instanceof Error ? e.message : 'Could not create lead.') } finally { setBusy(false) } }
  const select = (key: string, labelText: string, rows: JsonObject[], onChange?: (value: string) => void) => <label>{labelText}<select value={form[key] || ''} onChange={(e) => { set(key, e.target.value); onChange?.(e.target.value) }}><option value="">Select {labelText.toLowerCase()}</option>{rows.map((r, i) => <option key={i} value={optionId(r)}>{optionLabel(r)}</option>)}</select></label>
  return <><PageHeader title="Create Lead" description="Capture a company, primary contact, source, ownership, and product requirements." /><form className="lead-form" onSubmit={submit}><section className="form-section"><h2>Company details</h2><div className="form-grid"><label>Company name<input required value={form.CustomerName || ''} onChange={(e) => set('CustomerName', e.target.value)} /></label><label>Address<input value={form.Address || ''} onChange={(e) => set('Address', e.target.value)} /></label>{select('Ref_CountryId', 'Country', master.countries || [], (v) => { setForm((f) => ({ ...f, Ref_StateId: '', Ref_CityId: '' })); setStates([]); setCities([]); if (v) loadStates(token, v).then(setStates) })}{select('Ref_StateId', 'State', states, (v) => { set('Ref_CityId', ''); setCities([]); if (v) loadCities(token, v).then(setCities) })}{select('Ref_CityId', 'City', cities)}<label>Pin code<input value={form.PinCode || ''} onChange={(e) => set('PinCode', e.target.value)} /></label><label>GST<input value={form.Gst || ''} onChange={(e) => set('Gst', e.target.value)} /></label><label>PAN<input value={form.Pan || ''} onChange={(e) => set('Pan', e.target.value)} /></label></div></section><section className="form-section"><h2>Primary contact</h2><div className="form-grid"><label>Contact person<input required value={contact.ContactPerson} onChange={(e) => setContact({ ...contact, ContactPerson: e.target.value })} /></label><label>Mobile<input value={contact.Mobile} onChange={(e) => setContact({ ...contact, Mobile: e.target.value })} /></label><label>Email<input type="email" value={contact.Email} onChange={(e) => setContact({ ...contact, Email: e.target.value })} /></label>{<label>Designation<select value={contact.Ref_DesignationId} onChange={(e) => setContact({ ...contact, Ref_DesignationId: e.target.value })}><option value="">Select designation</option>{(master.designations || []).map((r, i) => <option key={i} value={optionId(r)}>{optionLabel(r)}</option>)}</select></label>}</div></section><section className="form-section"><h2>Source and ownership</h2><div className="form-grid">{select('Ref_LeadSourceId', 'Lead source', master.sources || [])}{select('AssignedToEmployeeId', 'Assigned employee', master.employees || [])}<label>Requirement notes<textarea value={form.Requirement || ''} onChange={(e) => set('Requirement', e.target.value)} /></label><label>Lead remark<textarea value={form.LeadRemark || ''} onChange={(e) => set('LeadRemark', e.target.value)} /></label></div></section><section className="form-section"><div className="section-heading"><h2>Product requirements</h2><button type="button" className="button ghost" onClick={() => setReqs([...reqs, { ...reqs[0] }])}>+ Add row</button></div>{reqs.map((r, i) => <div className="requirement-row" key={i}>{<select value={r.Ref_ProductCategoryId} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, Ref_ProductCategoryId: e.target.value, Ref_OfferingId: '', Ref_ProductId: '' }; setReqs(next); if (e.target.value) loadOfferings(token, e.target.value).then(setOfferingsState) }}><option value="">Category</option>{(master.categories || []).map((x, j) => <option key={j} value={optionId(x)}>{optionLabel(x)}</option>)}</select>}<select value={r.Ref_OfferingId} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, Ref_OfferingId: e.target.value, Ref_ProductId: '' }; setReqs(next); if (e.target.value) loadProducts(token, e.target.value).then(setProductsState) }}><option value="">Offering</option>{offerings.map((x, j) => <option key={j} value={optionId(x)}>{optionLabel(x)}</option>)}</select><select value={r.Ref_ProductId} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, Ref_ProductId: e.target.value }; setReqs(next) }}><option value="">Product</option>{products.map((x, j) => <option key={j} value={optionId(x)}>{optionLabel(x)}</option>)}</select><input type="number" min="0" step="any" value={r.Quantity} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, Quantity: e.target.value }; setReqs(next) }} placeholder="Qty" /><select value={r.Ref_UnitId} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, Ref_UnitId: e.target.value }; setReqs(next) }}><option value="">Unit</option>{(master.units || []).map((x, j) => <option key={j} value={optionId(x)}>{optionLabel(x)}</option>)}</select><input value={r.RequirementRemark} onChange={(e) => { const next = [...reqs]; next[i] = { ...r, RequirementRemark: e.target.value }; setReqs(next) }} placeholder="Remark" /></div>)}</section>{error && <ErrorState message={error} />}{success && <div className="alert success">{success}</div>}<div className="form-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create lead'}</button><span className="subtle">Attachments will be added in a later slice.</span></div></form></>
}

function AttendancePage({ token }: { token: string }) {
  const [date, setDate] = useState('')
  const [rows, setRows] = useState<JsonObject[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const search = (event?: FormEvent) => { event?.preventDefault(); setLoading(true); setError(''); loadAttendance(token, date ? { attendanceDate: date } : {}).then(setRows).catch((caught) => setError(caught instanceof Error ? caught.message : 'Attendance request failed.')).finally(() => setLoading(false)) }
  useEffect(() => search(), [token])
  return <><PageHeader title="Attendance" description="Review attendance records using the attendance API." /><form className="filter-bar" onSubmit={search}><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="button primary" disabled={loading}>{loading ? 'Searching…' : 'Search attendance'}</button></form>{error && <ErrorState message={error} retry={() => search()} />}{loading && <LoadingState />}{!loading && !error && <section className="table-panel"><div className="table-toolbar"><div><b>{rows.length} records</b><span>POST /api/attendance/GetAttendance</span></div></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>Employee</th><th>Date</th><th>First in</th><th>Last out</th><th>Hours</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{text(field(row, 'employeeName', 'employeeCode'))}</td><td>{text(field(row, 'attendanceDate'))}</td><td>{text(field(row, 'firstInTime'))}</td><td>{text(field(row, 'lastOutTime'))}</td><td>{text(field(row, 'workingHours'))}</td><td>{text(field(row, 'status', 'attendanceStatus'))}</td></tr>)}</tbody></table></div> : <div className="empty">No attendance records found.</div>}</section>}</>}

function LeavePage({ token, user }: { token: string; user: User }) {
  const employeeId = field(user, 'employeeId', 'EmployeeId')
  const [data, setData] = useState<{ balance: JsonObject[]; leaves: JsonObject[]; types: JsonObject[] }>({ balance: [], leaves: [], types: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = () => { setLoading(true); setError(''); if (!employeeId) { setError('The login response did not include EmployeeId, so leave APIs cannot be queried.'); setLoading(false); return } loadLeaveData(token, String(employeeId)).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Leave request failed.')).finally(() => setLoading(false)) }
  useEffect(refresh, [token, employeeId])
  return <><PageHeader title="Leave" description="See your leave balance, applications, and available leave types." action={<button className="button ghost" onClick={refresh}>↻ Refresh</button>} />{loading && <LoadingState />}{error && <ErrorState message={error} retry={refresh} />}{!loading && !error && <><div className="metric-grid">{data.balance.map((row, index) => <div className="metric-card" key={index}><span>{text(field(row, 'leaveName', 'leaveCode'), 'Leave')}</span><strong>{text(field(row, 'balance'), '0')}</strong><small>Available balance</small></div>)}{!data.balance.length && <div className="empty">No leave balance was returned.</div>}</div><section className="table-panel"><div className="table-toolbar"><div><b>My applications</b><span>{data.leaves.length} records</span></div></div>{data.leaves.length ? <div className="table-scroll"><table><thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Reason</th></tr></thead><tbody>{data.leaves.map((row, index) => <tr key={index}><td>{text(field(row, 'leaveName', 'leaveCode'))}</td><td>{text(field(row, 'fromDate'))}</td><td>{text(field(row, 'toDate'))}</td><td>{text(field(row, 'totalDays'))}</td><td><span className="status-pill">{text(field(row, 'status'))}</span></td><td>{text(field(row, 'reason'))}</td></tr>)}</tbody></table></div> : <div className="empty">No leave applications found.</div>}</section></>}</>}

function MasterDataPage({ token }: { token: string }) {
  const [data, setData] = useState<{ companies: JsonObject[]; employees: JsonObject[] }>({ companies: [], employees: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = () => { setLoading(true); setError(''); loadMasterData(token).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Master data request failed.')).finally(() => setLoading(false)) }
  useEffect(refresh, [token])
  return <><PageHeader title="Master data" description="Reference data used by CRM forms and workflow screens." action={<button className="button ghost" onClick={refresh}>↻ Refresh</button>} />{loading && <LoadingState />}{error && <ErrorState message={error} retry={refresh} />}{!loading && !error && <div className="master-grid"><ReferenceCard title="Companies" endpoint="GET /api/master/companies" rows={data.companies} keys={['companyName', 'name']} /><ReferenceCard title="Employees" endpoint="GET /api/master/employees" rows={data.employees} keys={['employeeName', 'firstName', 'name']} /></div>}</>}

function ReferenceCard({ title, endpoint, rows, keys }: { title: string; endpoint: string; rows: JsonObject[]; keys: string[] }) {
  return <section className="panel"><div className="panel-title"><div><h2>{title}</h2><p>{endpoint}</p></div><span>{rows.length}</span></div>{rows.length ? <div className="compact-list">{rows.slice(0, 8).map((row, index) => <div className="compact-row" key={index}><b>{text(field(row, ...keys))}</b><span>{text(field(row, 'code', 'employeeCode', 'companyCode', 'departmentName'))}</span></div>)}</div> : <p className="empty-copy">No reference records returned.</p>}</section>
}

function ApiConsole({ token }: { token: string }) {
  const [selected, setSelected] = useState(apiCatalog[0])
  const [path, setPath] = useState(selected.path)
  const [method, setMethod] = useState(selected.method)
  const [body, setBody] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const grouped = useMemo(() => apiCatalog.reduce<Record<string, typeof apiCatalog>>((groups, item) => { (groups[item.group] ||= []).push(item); return groups }, {}), [])
  function choose(item: typeof apiCatalog[number]) { setSelected(item); setPath(item.path); setMethod(item.method); setError(''); setResult(null) }
  async function run(event: FormEvent) {
    event.preventDefault(); setError(''); setResult(null); setBusy(true)
    try { const parsed = body.trim() ? JSON.parse(body) : undefined; setResult(await apiRequest(path, { method, ...(parsed === undefined ? {} : { body: JSON.stringify(parsed) }) }, token)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'API call failed.') }
    finally { setBusy(false) }
  }
  return <><PageHeader title="API console" description="Every connected backend area is listed here. Use this for actions whose request fields vary by role or workflow." /><div className="console-layout"><aside className="endpoint-list">{Object.entries(grouped).map(([group, items]) => <div key={group}><span className="nav-caption">{group}</span>{items.map((item) => <button className={selected.path === item.path ? 'endpoint active' : 'endpoint'} key={`${item.method}${item.path}`} onClick={() => choose(item)}><b className={`method ${item.method.toLowerCase()}`}>{item.method}</b><span>{item.label}</span></button>)}</div>)}</aside><section className="console-card"><div className="console-intro"><p className="kicker">Connected request</p><h2>{selected.label}</h2><p className="subtle">The saved JWT is sent automatically as a Bearer token.</p></div><form className="stack" onSubmit={run}><div className="console-url"><select value={method} onChange={(event) => setMethod(event.target.value)}><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select><input value={path} onChange={(event) => setPath(event.target.value)} /></div><label>JSON body <span className="hint">Optional for GET requests</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={'{\n  "field": "value"\n}'} rows={10} /></label><button className="button primary" disabled={busy}>{busy ? 'Calling API…' : 'Send request'}</button></form>{error && <ErrorState message={error} />}{result !== null && <pre className="result">{JSON.stringify(result, null, 2)}</pre>}</section></div></>}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession())
  useEffect(() => { const logout = () => setSession(null); window.addEventListener('crm:unauthorized', logout); return () => window.removeEventListener('crm:unauthorized', logout) }, [])
  function signedIn(token: string, user: User) { saveSession({ token, user }); setSession({ token, user }) }
  function logout() { clearSession(); setSession(null) }
  if (!session) return <LoginPage onSuccess={signedIn} />
  return <Shell token={session.token} user={session.user} onLogout={logout} />
}
