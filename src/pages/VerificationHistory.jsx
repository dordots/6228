import React, { useState, useEffect, useMemo } from "react";
import { DailyVerification } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Shield, Search, Filter, Clock, FileText, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export default function VerificationHistoryPage() {
  const [verifications, setVerifications] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [filters, setFilters] = useState({
    dateRange: "week", // week, month, all, custom
    division: "all",
    verifiedBy: "all",
    search: "",
    startDate: "", // For custom date range (YYYY-MM-DD format)
    endDate: ""    // For custom date range (YYYY-MM-DD format)
  });

  // Report generation state
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportParams, setReportParams] = useState({
    division: "",
    dateType: "thisWeek", // "thisWeek", "thisMonth", "single", "range", "all"
    singleDate: "",
    startDate: "",
    endDate: ""
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      const isAdmin = user?.role === 'admin';
      const isManager = user?.custom_role === 'manager';
      const isDivisionManager = user?.custom_role === 'division_manager';
      const isTeamLeader = user?.custom_role === 'team_leader';
      const userDivision = user?.division;
      const userTeam = user?.team;

      // Build filter based on role hierarchy
      let filter = {};
      if (isAdmin || isManager) {
        filter = {}; // See everything
      } else if (isDivisionManager && userDivision) {
        filter = { division_name: userDivision }; // See division only
      } else if (isTeamLeader && userDivision && userTeam) {
        filter = { division_name: userDivision, team_name: userTeam }; // See team only
      } else if (userDivision) {
        filter = { division_name: userDivision }; // Fallback
      }

      const [verificationsData, soldiersData] = await Promise.all([
        DailyVerification.filter(filter, "-created_date"),
        Soldier.filter(filter)
      ]);

      setVerifications(Array.isArray(verificationsData) ? verificationsData : []);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);

    } catch (error) {
      setVerifications([]);
      setSoldiers([]);
    }
    setIsLoading(false);
  };

  const { filteredVerifications, divisions, verifiers, dateRangeStats } = useMemo(() => {
    if (!Array.isArray(verifications)) return { filteredVerifications: [], divisions: [], verifiers: [], dateRangeStats: {} };

    // Get unique divisions and verifiers
    const uniqueDivisions = [...new Set(verifications.map(v => v.division_name).filter(Boolean))].sort();
    const uniqueVerifiers = [...new Set(verifications.map(v => v.verified_by_user_name).filter(Boolean))].sort();

    // Apply filters
    let filtered = verifications.filter(verification => {
      // Division filter
      if (filters.division !== "all" && verification.division_name !== filters.division) {
        return false;
      }
      
      // Verifier filter
      if (filters.verifiedBy !== "all" && verification.verified_by_user_name !== filters.verifiedBy) {
        return false;
      }
      
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const soldier = soldiers.find(s => s.soldier_id === verification.soldier_id);
        const soldierName = soldier ? `${soldier.first_name} ${soldier.last_name}`.toLowerCase() : '';
        const searchMatch = 
          verification.soldier_id.toLowerCase().includes(searchLower) ||
          soldierName.includes(searchLower) ||
          verification.verified_by_user_name.toLowerCase().includes(searchLower) ||
          verification.division_name.toLowerCase().includes(searchLower);
        
        if (!searchMatch) return false;
      }
      
      // Date range filter
      if (filters.dateRange !== "all") {
        const verificationDate = verification.verification_date; // Already in YYYY-MM-DD format

        if (filters.dateRange === "custom") {
          // Custom date range (from startDate to endDate)
          if (filters.startDate && verificationDate < filters.startDate) {
            return false;
          }
          if (filters.endDate && verificationDate > filters.endDate) {
            return false;
          }
        } else {
          // Week or Month range
          const verificationDateObj = new Date(verificationDate);
          const now = new Date();

          let startDate, endDate;
          if (filters.dateRange === "week") {
            startDate = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
            endDate = endOfWeek(now, { weekStartsOn: 0 });
          } else if (filters.dateRange === "month") {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
          }

          if (startDate && endDate) {
            if (verificationDateObj < startDate || verificationDateObj > endDate) {
              return false;
            }
          }
        }
      }
      
      return true;
    });

    // Calculate stats for the filtered period
    const statsMap = {};
    filtered.forEach(v => {
      const date = v.verification_date;
      if (!statsMap[date]) {
        statsMap[date] = { count: 0, divisions: new Set() };
      }
      statsMap[date].count++;
      statsMap[date].divisions.add(v.division_name);
    });

    const dateRangeStats = Object.entries(statsMap).map(([date, stats]) => ({
      date,
      count: stats.count,
      divisionsCount: stats.divisions.size
    })).sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      filteredVerifications: filtered,
      divisions: uniqueDivisions,
      verifiers: uniqueVerifiers,
      dateRangeStats
    };
  }, [verifications, soldiers, filters]);

  const getSoldierName = (soldierId) => {
    const soldier = soldiers.find(s => s.soldier_id === soldierId);
    return soldier ? `${soldier.first_name} ${soldier.last_name}` : 'Unknown';
  };

  // CSV generation and download functions
  const convertToCSV = (data, headers) => {
    const BOM = '\uFEFF'; // UTF-8 Byte Order Mark for proper Hebrew support
    if (!Array.isArray(data) || data.length === 0) {
      return BOM + (headers ? headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') : '');
    }

    const finalHeaders = headers || Object.keys(data[0]);
    const csvRows = [
      finalHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')
    ];

    data.forEach(item => {
      const row = finalHeaders.map(header => {
        let value = item[header] !== undefined && item[header] !== null ? item[header] : '';
        value = String(value);
        return `"${value.replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    });

    return BOM + csvRows.join('\n');
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    if (!reportParams.division) {
      return;
    }

    if (reportParams.dateType === "single" && !reportParams.singleDate) {
      return;
    }

    if (reportParams.dateType === "range" && (!reportParams.startDate || !reportParams.endDate)) {
      return;
    }

    setIsGeneratingReport(true);
    try {
      // Filter verifications based on report parameters
      let filtered = verifications.filter(verification => {
        // Division filter - "all" means all divisions (admin only)
        if (reportParams.division !== "all" && verification.division_name !== reportParams.division) {
          return false;
        }

        // Date filter
        const verificationDate = verification.verification_date; // Already in YYYY-MM-DD format
        
        if (reportParams.dateType === "all") {
          // No date filtering - include all dates
        } else if (reportParams.dateType === "thisWeek") {
          const verificationDateObj = new Date(verificationDate);
          const now = new Date();
          const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
          const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
          if (verificationDateObj < weekStart || verificationDateObj > weekEnd) {
            return false;
          }
        } else if (reportParams.dateType === "thisMonth") {
          const verificationDateObj = new Date(verificationDate);
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);
          if (verificationDateObj < monthStart || verificationDateObj > monthEnd) {
            return false;
          }
        } else if (reportParams.dateType === "single") {
          if (verificationDate !== reportParams.singleDate) {
            return false;
          }
        } else if (reportParams.dateType === "range") {
          // Date range
          if (reportParams.startDate && verificationDate < reportParams.startDate) {
            return false;
          }
          if (reportParams.endDate && verificationDate > reportParams.endDate) {
            return false;
          }
        }

        return true;
      });

      // Sort by date and time
      filtered.sort((a, b) => {
        const dateA = a.verification_date || '';
        const dateB = b.verification_date || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA); // Newest first
        }
        const timeA = a.verification_timestamp || a.created_date || '';
        const timeB = b.verification_timestamp || b.created_date || '';
        return timeB.localeCompare(timeA);
      });

      // Prepare data for CSV
      const reportData = filtered.map(verification => {
        const soldier = soldiers.find(s => s.soldier_id === verification.soldier_id);
        const soldierName = soldier ? `${soldier.first_name} ${soldier.last_name}` : 'Unknown';
        const time = verification.verification_timestamp 
          ? format(new Date(verification.verification_timestamp), 'HH:mm')
          : verification.created_date 
          ? format(new Date(verification.created_date), 'HH:mm')
          : 'N/A';

        return {
          'Date': verification.verification_date 
            ? format(new Date(verification.verification_date), 'MMM dd, yyyy')
            : 'N/A',
          'Soldier Name': soldierName,
          'Soldier ID': verification.soldier_id || '',
          'Division': verification.division_name || '',
          'Verified By': verification.verified_by_user_name || '',
          'Time': time
        };
      });

      // Generate CSV
      const headers = ['Date', 'Soldier Name', 'Soldier ID', 'Division', 'Verified By', 'Time'];
      const csvContent = convertToCSV(reportData, headers);

      // Generate filename
      let filename = `Verification_Report_${reportParams.division === "all" ? "All_Divisions" : reportParams.division.replace(/\s+/g, '_')}`;
      if (reportParams.dateType === "thisWeek") {
        filename += `_This_Week`;
      } else if (reportParams.dateType === "thisMonth") {
        filename += `_This_Month`;
      } else if (reportParams.dateType === "single") {
        filename += `_${reportParams.singleDate}`;
      } else if (reportParams.dateType === "range") {
        filename += `_${reportParams.startDate}_to_${reportParams.endDate}`;
      } else if (reportParams.dateType === "all") {
        filename += `_All_Time`;
      }

      downloadCSV(csvContent, filename);
      setShowReportDialog(false);
      
      // Reset form
      setReportParams({
        division: "",
        dateType: "thisWeek",
        singleDate: "",
        startDate: "",
        endDate: ""
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Verification History</h1>
          <p className="text-slate-600">Review all daily equipment verification records.</p>
        </div>
        <Button
          onClick={() => setShowReportDialog(true)}
          className="flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{filteredVerifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Unique Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{dateRangeStats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Divisions Involved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{divisions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {filters.dateRange === "custom" && (
            <>
              <Input
                type="date"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full"
              />
              <Input
                type="date"
                placeholder="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full"
              />
            </>
          )}

          <Select value={filters.division} onValueChange={(value) => setFilters(prev => ({ ...prev, division: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map(division => (
                <SelectItem key={division} value={division}>{division}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.verifiedBy} onValueChange={(value) => setFilters(prev => ({ ...prev, verifiedBy: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Verified By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verifiers</SelectItem>
              {verifiers.map(verifier => (
                <SelectItem key={verifier} value={verifier}>{verifier}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search soldier, verifier..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Verification Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Soldier</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Verified By</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(10).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredVerifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                      No verification records found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVerifications.map((verification) => (
                    <TableRow key={verification.id}>
                      <TableCell className="font-medium">
                        {verification.verification_date ? format(new Date(verification.verification_date), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{getSoldierName(verification.soldier_id)}</span>
                          <span className="text-xs text-slate-500">ID: {verification.soldier_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {verification.division_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          {verification.verified_by_user_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {verification.verification_timestamp ? format(new Date(verification.verification_timestamp), 'HH:mm') :
                           verification.created_date ? format(new Date(verification.created_date), 'HH:mm') : 'N/A'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Report Generation Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Verification Report
            </DialogTitle>
            <DialogDescription>
              Generate a CSV report of verifications for a division (or all divisions for admins) and selected date period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="report-division">Division *</Label>
              <Select
                value={reportParams.division}
                onValueChange={(value) => setReportParams(prev => ({ ...prev, division: value }))}
              >
                <SelectTrigger id="report-division">
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {(currentUser?.role === 'admin') && (
                    <SelectItem value="all">All Divisions</SelectItem>
                  )}
                  {divisions.map(division => (
                    <SelectItem key={division} value={division}>{division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-date-type">Date Selection *</Label>
              <Select
                value={reportParams.dateType}
                onValueChange={(value) => setReportParams(prev => ({ ...prev, dateType: value }))}
              >
                <SelectTrigger id="report-date-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="single">Single Date</SelectItem>
                  <SelectItem value="range">Date Range</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportParams.dateType === "single" && (
              <div className="space-y-2">
                <Label htmlFor="report-single-date">Date *</Label>
                <Input
                  id="report-single-date"
                  type="date"
                  value={reportParams.singleDate}
                  onChange={(e) => setReportParams(prev => ({ ...prev, singleDate: e.target.value }))}
                />
              </div>
            )}

            {reportParams.dateType === "range" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="report-start-date">Start Date *</Label>
                  <Input
                    id="report-start-date"
                    type="date"
                    value={reportParams.startDate}
                    onChange={(e) => setReportParams(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-end-date">End Date *</Label>
                  <Input
                    id="report-end-date"
                    type="date"
                    value={reportParams.endDate}
                    onChange={(e) => setReportParams(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReportDialog(false)}
              disabled={isGeneratingReport}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || !reportParams.division || 
                (reportParams.dateType === "single" && !reportParams.singleDate) ||
                (reportParams.dateType === "range" && (!reportParams.startDate || !reportParams.endDate))}
              className="flex items-center gap-2"
            >
              {isGeneratingReport ? (
                <>
                  <Download className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}