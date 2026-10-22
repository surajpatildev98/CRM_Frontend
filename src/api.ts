export type JsonObject = Record<string, unknown>

// The API is currently being run with the HTTPS launch profile on port 7022.
// Keep this configurable so it can be changed later without editing the code.
export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'https://localhost:7022').replace(/\/$/, '')

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function field(value: unknown, ...names: string[]): unknown {
  if (!isObject(value)) return undefined
  const key = Object.keys(value).find((candidate) => names.some((name) => candidate.toLowerCase() === name.toLowerCase()))
  return key === undefined ? undefined : value[key]
}

export function unwrap(value: unknown): unknown {
  if (!isObject(value)) return value
  // Preserve a genuine null Data value: it means an empty result, not the envelope.
  const key = Object.keys(value).find((name) => name.toLowerCase() === 'data')
  return key === undefined ? value : value[key]
}

export function asRows(value: unknown): JsonObject[] {
  const data = unwrap(value)
  if (Array.isArray(data)) return data.filter(isObject)
  if (isObject(data)) {
    const rows = field(data, 'items', 'rows', 'records')
    if (Array.isArray(rows)) return rows.filter(isObject)
    return Object.keys(data).length ? [data] : []
  }
  return []
}

export function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function label(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path: string, options: RequestInit = {}, token = ''): Promise<unknown> {
  // Never send the JWT to an arbitrary URL, including one supplied by a schema.
  if (!/^\/(api\/|swagger\/)/i.test(path) || path.includes('://') || path.includes('\\')) {
    throw new ApiError('Only this CRM API can be called.')
  }
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const timeout = AbortSignal.timeout(30000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal, redirect: 'error' })
  } catch (error) {
    if (options.signal?.aborted) throw error
    const uncertain = options.method && options.method !== 'GET'
      ? ' The server may have received this request. Check the records before submitting again.' : ''
    throw new ApiError(`Cannot reach ${API_BASE}. Check the API, CORS, and HTTP/HTTPS settings.${uncertain}`)
  }
  if (response.status === 401 && token && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('crm:unauthorized'))
  }
  if (response.status === 204) return null
  const raw = await response.text()
  let body: unknown
  try { body = raw ? JSON.parse(raw) : null } catch {
    throw new ApiError(response.ok ? 'The API returned an unexpected non-JSON response.' : `Request failed (${response.status}).`, response.status)
  }
  const fallback = response.status === 401 ? 'Your session has expired. Please sign in again.'
    : response.status === 403 ? 'Your account does not have permission for this action.'
    : `Request failed (${response.status}).`
  if (!response.ok || field(body, 'status', 'success') === false) {
    const validation = field(body, 'errors')
    const details = isObject(validation) ? Object.values(validation).flat().join(' ') : ''
    throw new ApiError(details || text(field(body, 'message', 'title'), fallback), response.status)
  }
  return body
}

export async function login(loginId: string, password: string) {
  const body = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginId, password }) })
  const data = unwrap(body)
  const token = field(data, 'token', 'accessToken', 'jwt')
  if (typeof token !== 'string' || !token.trim() || !isObject(data)) throw new ApiError('The login response did not contain a token and user data.')
  const nestedUser = field(data, 'user')
  // The backend returns profile fields next to Token. Keep the profile separately.
  const user = Object.fromEntries(Object.entries(isObject(nestedUser) ? nestedUser : data)
    .filter(([key]) => !/token|password/i.test(key)))
  return { token, user }
}

export const endpoints = {
  dashboard: '/api/dashboard/my-dashboard',
  employees: '/api/Employee/GetEmployeeMaster',
  employeeProbation: '/api/EmployeeProbation/employees',
  leads: '/api/Lead/Details',
  opportunities: '/api/Opportunity/list',
  announcements: '/api/Announcement',
  tickets: '/api/Ticket/my-tickets',
  companies: '/api/master/companies',
  masterEmployees: '/api/master/employees',
  shifts: '/api/shift/GetShifts?activeOnly=true',
  leaveTypes: '/api/Leave/GetApplyLeaveTypes',
}

export type LeadFilter = { searchText?: string; filterStatusId?: string | number; filterAssignedToId?: string | number; showCreatedAndAssigned?: boolean; leadId?: string | number }
export async function loadLeadDetails(token: string, filter: LeadFilter = {}) {
  return asRows(await apiRequest(withQuery(endpoints.leads, filter), {}, token))
}
export async function loadLeadMasterData(token: string) {
  const paths = ['/api/master/lead-sources', '/api/master/employees', '/api/master/countries', '/api/master/designations', '/api/master/categories', '/api/master/units']
  const values = await Promise.all(paths.map((path) => apiRequest(path, {}, token)))
  return { sources: asRows(values[0]), employees: asRows(values[1]), countries: asRows(values[2]), designations: asRows(values[3]), categories: asRows(values[4]), units: asRows(values[5]) }
}
export async function loadStates(token: string, countryId: string | number) { return asRows(await apiRequest(withQuery('/api/master/states-by-country', { countryId }), {}, token)) }
export async function loadCities(token: string, stateId: string | number) { return asRows(await apiRequest(withQuery('/api/master/cities-by-state', { stateId }), {}, token)) }
export async function loadOfferings(token: string, categoryId: string | number) { return asRows(await apiRequest(withQuery('/api/master/offerings', { categoryId }), {}, token)) }
export async function loadProducts(token: string, offeringId: string | number) { return asRows(await apiRequest(withQuery('/api/master/products', { offeringId }), {}, token)) }
export async function registerLead(token: string, request: JsonObject) { return apiRequest('/api/Lead/Register', { method: 'POST', body: JSON.stringify(request) }, token) }

export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const query = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path
}

export async function loadDashboard(token: string) { return unwrap(await apiRequest(endpoints.dashboard, {}, token)) }
export async function loadEmployees(token: string) { return asRows(await apiRequest(endpoints.employees, {}, token)) }
export async function loadLeads(token: string) { return asRows(await apiRequest(endpoints.leads, {}, token)) }
export async function loadOpportunities(token: string) { return asRows(await apiRequest(endpoints.opportunities, {}, token)) }
export async function loadAnnouncements(token: string) { return asRows(await apiRequest(endpoints.announcements, {}, token)) }
export async function loadTickets(token: string) { return asRows(await apiRequest(endpoints.tickets, {}, token)) }
export async function loadMasterData(token: string) {
  const [companies, employees] = await Promise.all([
    apiRequest(endpoints.companies, {}, token), apiRequest(endpoints.masterEmployees, {}, token),
  ])
  return { companies: asRows(companies), employees: asRows(employees) }
}
export async function loadLeaveData(token: string, employeeId: string | number) {
  const [balance, leaves, types] = await Promise.all([
    apiRequest(withQuery('/api/leave/GetLeaveBalance', { employeeId }), {}, token),
    apiRequest(withQuery('/api/leave/GetMyLeaves', { employeeId }), {}, token),
    apiRequest(withQuery('/api/leave/GetApplyLeaveTypes', { employeeId }), {}, token),
  ])
  return { balance: asRows(balance), leaves: asRows(leaves), types: asRows(types) }
}
export async function loadAttendance(token: string, request: JsonObject = {}) {
  return asRows(await apiRequest('/api/attendance/GetAttendance', { method: 'POST', body: JSON.stringify(request) }, token))
}

export const apiCatalog: Array<{ group: string; method: string; path: string; label: string }> = [
  { group: 'Authentication', method: 'POST', path: '/api/auth/forgot_password', label: 'Forgot password' },
  { group: 'Authentication', method: 'POST', path: '/api/auth/verify_otp', label: 'Verify reset OTP' },
  { group: 'Authentication', method: 'POST', path: '/api/auth/Reset_password', label: 'Reset password' },
  { group: 'Dashboard', method: 'GET', path: '/api/dashboard/Details', label: 'Dashboard details' },
  { group: 'Dashboard', method: 'GET', path: '/api/dashboard/employee-performance', label: 'Employee performance' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/Register', label: 'Register lead' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/Transfer', label: 'Transfer lead' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/UpdateStatus', label: 'Update lead status' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/CreateActivity', label: 'Create lead activity' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/CreateFollowUp', label: 'Create lead follow-up' },
  { group: 'Leads', method: 'POST', path: '/api/Lead/CloseLead', label: 'Close lead' },
  { group: 'Opportunities', method: 'GET', path: '/api/Opportunity/wonleads', label: 'Won leads' },
  { group: 'Opportunities', method: 'GET', path: '/api/Opportunity/types', label: 'Opportunity types' },
  { group: 'Opportunities', method: 'GET', path: '/api/Opportunity/stages', label: 'Opportunity stages' },
  { group: 'Opportunities', method: 'POST', path: '/api/Opportunity/convert', label: 'Convert opportunity' },
  { group: 'Employees', method: 'POST', path: '/api/Employee/Register', label: 'Register employee' },
  { group: 'Employees', method: 'POST', path: '/api/Employee/UpdateEmployee', label: 'Update employee' },
  { group: 'Attendance', method: 'POST', path: '/api/attendance/GetPunches', label: 'Get punches' },
  { group: 'Attendance', method: 'POST', path: '/api/attendance/ManualPunch', label: 'Manual punch' },
  { group: 'Leave', method: 'POST', path: '/api/leave/ApplyLeave', label: 'Apply leave' },
  { group: 'Leave', method: 'POST', path: '/api/leave/CancelLeave', label: 'Cancel leave' },
  { group: 'Tickets', method: 'POST', path: '/api/Ticket/create', label: 'Create ticket' },
  { group: 'Tickets', method: 'POST', path: '/api/Ticket/UpdateStatus', label: 'Update ticket status' },
  { group: 'Announcements', method: 'POST', path: '/api/Announcement/CreateAnnouncement', label: 'Create announcement' },
  { group: 'Announcements', method: 'PUT', path: '/api/Announcement', label: 'Update announcement' },
  { group: 'Reports', method: 'GET', path: '/api/Reports/filters', label: 'Report filters' },
  { group: 'Reports', method: 'POST', path: '/api/Reports/dashboard', label: 'Dashboard report' },
  { group: 'Reports', method: 'POST', path: '/api/Reports/journey', label: 'Journey report' },
  { group: 'Master data', method: 'GET', path: '/api/master/companies', label: 'Companies' },
  { group: 'Master data', method: 'GET', path: '/api/master/employees', label: 'Employees lookup' },
  { group: 'Permissions', method: 'GET', path: '/api/PermissionManager/modules', label: 'Permission modules' },
  { group: 'Permissions', method: 'GET', path: '/api/PermissionManager/super-modules', label: 'Super modules' },
  { group: 'Scheduler', method: 'GET', path: '/api/Scheduler/jobsList', label: 'Scheduler jobs' },
  { group: 'Scheduler', method: 'POST', path: '/api/Scheduler/job/create', label: 'Create scheduler job' },
  { group: 'Shifts', method: 'GET', path: '/api/shift/GetShifts?activeOnly=true', label: 'Shifts' },
  { group: 'Holiday', method: 'GET', path: '/api/holiday/GetCalendars', label: 'Holiday calendars' },
  { group: 'Freight', method: 'GET', path: '/api/FreightPolicy/GetPolicyList', label: 'Freight policies' },
]
