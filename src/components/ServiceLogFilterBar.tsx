import { Search, X } from 'lucide-react'

type ServiceLogFilters = {
  serviceType: 'all' | 'registrar' | 'finance' | 'ict_helpdesk'
  status: 'served' | 'cancelled' | 'both'
  days: number
  search: string
}

interface ServiceLogFilterBarProps {
  filters: ServiceLogFilters
  onFiltersChange: (filters: ServiceLogFilters) => void
  totalCount: number
}

export default function ServiceLogFilterBar({ filters, onFiltersChange, totalCount }: ServiceLogFilterBarProps) {
  const handleServiceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      serviceType: e.target.value as ServiceLogFilters['serviceType']
    })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      status: e.target.value as ServiceLogFilters['status']
    })
  }

  const handleDaysChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      days: parseInt(e.target.value, 10)
    })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value
    })
  }

  const handleReset = () => {
    onFiltersChange({
      serviceType: 'all',
      status: 'served',
      days: 0,
      search: ''
    })
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-md p-6 mb-6 border border-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Filter Service Logs</h3>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 font-medium transition"
        >
          <X className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Service Type Filter */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Service Type
          </label>
          <select
            value={filters.serviceType}
            onChange={handleServiceTypeChange}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Services</option>
            <option value="registrar">Registrar</option>
            <option value="finance">Finance</option>
            <option value="ict_helpdesk">ICT Helpdesk</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={handleStatusChange}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="served">Served Only</option>
            <option value="cancelled">Cancelled Only</option>
            <option value="both">Both</option>
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Date Range
          </label>
          <select
            value={filters.days}
            onChange={handleDaysChange}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value={0}>Today</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={999}>All Time</option>
          </select>
        </div>

        {/* Search Filter */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Search (Name/ID)
          </label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Enter name or student ID..."
              className="w-full px-3 py-2 pl-10 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm text-gray-600 font-medium">
          <span className="text-gray-800 font-bold">{totalCount}</span> total entries
        </p>
        <p className="text-xs text-gray-500">Filters updated in real-time</p>
      </div>
    </div>
  )
}
