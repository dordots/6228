import React, { useState, useEffect, useMemo } from "react";
import { DailyVerification } from "@/api/entities";
import { Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Shield, Search, Filter, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export default function VerificationHistoryPage() {
  const [verifications, setVerifications] = useState([]);
  const [soldiers, setSoldiers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [filters, setFilters] = useState({
    dateRange: "week", // week, month, all
    division: "all",
    verifiedBy: "all",
    search: ""
  });

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
      const userDivision = user?.department;

      const filter = (isAdmin || isManager) ? {} : (userDivision ? { division_name: userDivision } : {});

      const [verificationsData, soldiersData] = await Promise.all([
        DailyVerification.filter(filter, "-created_date"),
        Soldier.filter(filter)
      ]);

      setVerifications(Array.isArray(verificationsData) ? verificationsData : []);
      setSoldiers(Array.isArray(soldiersData) ? soldiersData : []);

    } catch (error) {
      console.error("Error loading verification history:", error);
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
        const verificationDate = new Date(verification.verification_date);
        const now = new Date();
        
        let startDate, endDate;
        if (filters.dateRange === "week") {
          startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
          endDate = endOfWeek(now, { weekStartsOn: 1 });
        } else if (filters.dateRange === "month") {
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
        }
        
        if (startDate && endDate) {
          if (verificationDate < startDate || verificationDate > endDate) {
            return false;
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

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Verification History</h1>
        <p className="text-slate-600">Review all daily equipment verification records.</p>
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
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select value={filters.dateRange} onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

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
                          {verification.created_date ? format(new Date(verification.created_date), 'HH:mm') : 'N/A'}
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
    </div>
  );
}