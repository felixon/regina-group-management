import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Download, RefreshCw, ExternalLink, Globe, AlertCircle, CheckCircle, X, XCircle } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useDomains } from '../hooks/useDomains';
import { useW HOIS } from '../hooks/useWHOIS';
import { useExcelExport } from '../hooks/useExcelExport';
import { useCache } from '../hooks/useCache';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { Project, Domain, WHOISData } from '../types';

interface ProjectsProps {
  className?: string;
}

export const Projects: React.FC<ProjectsProps> = ({ className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof Project>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [whoisModalOpen, setWhoisModalOpen] = useState(false);
  const [whoisDomain, setWhoisDomain] = useState<string>('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeDomains: true,
    includeWhois: false,
    format: 'xlsx' as 'xlsx' | 'csv',
    filterActive: false
  });
  const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes
  const [cacheKey] = useState('projects-cache');
  const [performanceKey] = useState('projects-performance');

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects
  } = useProjects();

  const {
    domains,
    loading: domainsLoading,
    fetchDomains
  } = useDomains();

  const {
    whoisData,
    loading: whoisLoading,
    fetchWhoisData,
    clearCache
  } = useWHOIS();

  const {
    exportToExcel,
    exportToCSV,
    isExporting
  } = useExcelExport();

  const {
    getCachedData,
    setCachedData,
    clearCache: clearAppCache
  } = useCache();

  const {
    startTiming,
    endTiming,
    logPerformance
  } = usePerformanceMonitor();

  // Performance monitoring
  useEffect(() => {
    const timer = startTiming('Projects component render');
    return () => {
      endTiming(timer);
      logPerformance(performanceKey);
    };
  }, [startTiming, endTiming, logPerformance, performanceKey]);

  // Cache management
  useEffect(() => {
    const cached = getCachedData(cacheKey);
    if (cached && !projectsLoading) {
      console.log('Loading projects from cache');
    }
  }, [cacheKey, getCachedData, projectsLoading]);

  // Auto-refresh mechanism
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing projects data');
      refreshProjects();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshProjects, refreshInterval]);

  // WHOIS data fetching for selected domains
  const fetchWHOISForSelectedDomains = useCallback(async () => {
    if (selectedDomains.size === 0) return;

    const timer = startTiming('WHOIS data fetch');
    try {
      for (const domainId of selectedDomains) {
        const domain = domains.find(d => d.id === domainId);
        if (domain && !whoisData[domain.domain_name]) {
          await fetchWhoisData(domain.domain_name);
        }
      }
    } catch (error) {
      console.error('Error fetching WHOIS data:', error);
    } finally {
      endTiming(timer);
    }
  }, [selectedDomains, domains, whoisData, fetchWhoisData, startTiming, endTiming]);

  // Filter and sort projects
  const filteredProjects = React.useMemo(() => {
    const timer = startTiming('Project filtering and sorting');
    let filtered = projects.filter(project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort projects
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    endTiming(timer);
    return filtered;
  }, [projects, searchTerm, sortField, sortDirection, startTiming, endTiming]);

  // Pagination
  const paginatedProjects = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

  // Handle search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const timer = startTiming('Project search');
    // Search logic is handled by useMemo above
    endTiming(timer);
  }, [startTiming, endTiming]);

  // Handle sort
  const handleSort = useCallback((field: keyof Project) => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    setSortField(field);
  }, []);

  // Handle domain selection
  const handleDomainSelection = useCallback((domainId: string, checked: boolean) => {
    setSelectedDomains(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(domainId);
      } else {
        newSet.delete(domainId);
      }
      return newSet;
    });
  }, []);

  // Handle select all domains
  const handleSelectAllDomains = useCallback((checked: boolean) => {
    if (checked) {
      const allDomainIds = domains.map(d => d.id);
      setSelectedDomains(new Set(allDomainIds));
    } else {
      setSelectedDomains(new Set());
    }
  }, [domains]);

  // Handle WHOIS lookup
  const handleWhoisLookup = useCallback((domainName: string) => {
    setWhoisDomain(domainName);
    setWhoisModalOpen(true);
    fetchWhoisData(domainName);
  }, [fetchWhoisData]);

  // Handle export
  const handleExport = useCallback(async () => {
    const timer = startTiming('Data export');
    try {
      const data = projects.map(project => ({
        ...project,
        domains: exportOptions.includeDomains 
          ? domains.filter(d => d.project_id === project.id)
          : [],
        whois: exportOptions.includeWhois
          ? whoisData
          : {}
      }));

      if (exportOptions.format === 'xlsx') {
        await exportToExcel(data, 'projects-export.xlsx');
      } else {
        await exportToCSV(data, 'projects-export.csv');
      }
      setExportModalOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      endTiming(timer);
    }
  }, [projects, domains, whoisData, exportOptions, exportToExcel, exportToCSV, startTiming, endTiming]);

  // Clear all cache
  const handleClearCache = useCallback(async () => {
    const timer = startTiming('Cache clearing');
    try {
      await clearAppCache();
      clearCache();
      console.log('All cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      endTiming(timer);
    }
  }, [clearAppCache, clearCache, startTiming, endTiming]);

  // Render loading state
  if (projectsLoading && projects.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (projectsError) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center space-x-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-medium">Error Loading Projects</h3>
        </div>
        <p className="text-red-700 mt-2">{projectsError}</p>
        <button
          onClick={() => fetchProjects()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">
              Manage your projects and track their domains
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Cache Management */}
            <button
              onClick={handleClearCache}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Clear Cache</span>
            </button>

            {/* Export */}
            <button
              onClick={() => setExportModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>

            {/* Add Project */}
            <button
              onClick={() => {
                setSelectedProject(null);
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Project</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* Auto-refresh settings */}
        <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
          <span>Auto-refresh:</span>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded"
          >
            <option value={60000}>1 min</option>
            <option value={300000}>5 min</option>
            <option value={600000}>10 min</option>
            <option value={0}>Disabled</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Name</span>
                    {sortField === 'name' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Status</span>
                    {sortField === 'status' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domains
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Created</span>
                    {sortField === 'created_at' && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedProjects.map((project) => {
                const projectDomains = domains.filter(d => d.project_id === project.id);
                const selectedProjectDomains = projectDomains.filter(d => selectedDomains.has(d.id));
                
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {project.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {project.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {selectedProjectDomains.length}/{projectDomains.length}
                        </span>
                        {projectDomains.length > 0 && (
                          <div className="flex -space-x-1">
                            {projectDomains.slice(0, 3).map((domain) => (
                              <div
                                key={domain.id}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  selectedDomains.has(domain.id)
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                                title={domain.domain_name}
                              >
                                {domain.domain_name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {projectDomains.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                +{projectDomains.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedProject(project);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this project?')) {
                              deleteProject(project.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, filteredProjects.length)} of{' '}
                {filteredProjects.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Domains Section with Horizontal Scroll */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Domain Management</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedDomains.size === domains.length && domains.length > 0}
                  onChange={(e) => handleSelectAllDomains(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Select All</span>
              </div>
              {selectedDomains.size > 0 && (
                <button
                  onClick={fetchWHOISForSelectedDomains}
                  className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>WHOIS ({selectedDomains.size})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDomains.size === domains.length && domains.length > 0}
                    onChange={(e) => handleSelectAllDomains(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WHOIS
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {domains.map((domain) => {
                const project = projects.find(p => p.id === domain.project_id);
                const whoisInfo = whoisData[domain.domain_name];
                
                return (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedDomains.has(domain.id)}
                        onChange={(e) => handleDomainSelection(domain.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-medium text-gray-900">
                          {domain.domain_name}
                        </div>
                        <a
                          href={`https://${domain.domain_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        domain.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : domain.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {domain.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {domain.expiry_date 
                        ? new Date(domain.expiry_date).toLocaleDateString()
                        : 'N/A'
                      }
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {whoisInfo ? (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-600">Available</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-red-600">Unknown</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleWhoisLookup(domain.domain_name)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Refresh
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleWhoisLookup(domain.domain_name)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Globe className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* WHOIS Modal */}
      {whoisModalOpen && whoisDomain && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                WHOIS Information for {whoisDomain}
              </h3>
              <button
                onClick={() => setWhoisModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="px-6 py-4">
              {whoisLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Fetching WHOIS data...</span>
                </div>
              ) : whoisData[whoisDomain] ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(whoisData[whoisDomain]).map(([key, value]) => (
                      <div key={key} className="border-b border-gray-200 pb-2">
                        <dt className="text-sm font-medium text-gray-500 capitalize">
                          {key.replace(/_/g, ' ')}
                        </dt>
                        <dd className="text-sm text-gray-900 mt-1">
                          {value || 'N/A'}
                        </dd>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-600">Failed to fetch WHOIS data</p>
                  <button
                    onClick={() => fetchWhoisData(whoisDomain)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Export Projects</h3>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'xlsx' | 'csv' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeDomains}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeDomains: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Include domain information
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeWhois}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeWhois: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Include WHOIS data
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportOptions.filterActive}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, filterActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Only export currently filtered results
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedProject ? 'Edit Project' : 'Add New Project'}
              </h3>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const projectData = {
                name: formData.get('name') as string,
                description: formData.get('description') as string,
                status: formData.get('status') as string,
              };

              if (selectedProject) {
                updateProject(selectedProject.id, projectData);
              } else {
                createProject(projectData);
              }
              
              setIsModalOpen(false);
              setSelectedProject(null);
            }}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    defaultValue={selectedProject?.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    defaultValue={selectedProject?.description || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter project description"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="status"
                    id="status"
                    required
                    defaultValue={selectedProject?.status || 'active'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedProject(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {selectedProject ? 'Update' : 'Create'} Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};