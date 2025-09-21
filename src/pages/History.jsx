
import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, PlusCircle, Edit, Trash2, CheckCircle, Wrench, Target, Clock, Users, Shield, Package } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Table as DetailTable, TableBody as DetailTableBody, TableCell as DetailTableCell, TableHead as DetailTableHead, DetailTableHeader, TableRow as DetailTableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";

const activityIcons = {
  CREATE: <PlusCircle className="w-4 h-4 text-green-600" />,
  UPDATE: <Edit className="w-4 h-4 text-blue-600" />,
  DELETE: <Trash2 className="w-4 h-4 text-red-600" />,
  ASSIGN: <CheckCircle className="w-4 h-4 text-indigo-600" />,
  UNASSIGN: <CheckCircle className="w-4 h-4 text-orange-600" />,
  INSPECT: <Wrench className="w-4 h-4 text-yellow-600" />,
  DEPOSIT: <Target className="w-4 h-4 text-blue-600" />,
  RELEASE: <Target className="w-4 h-4 text-green-600" />,
  default: <Clock className="w-4 h-4 text-slate-500" />
};

const activityTypeColors = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  ASSIGN: 'bg-indigo-100 text-indigo-800',
  UNASSIGN: 'bg-orange-100 text-orange-800',
  INSPECT: 'bg-yellow-100 text-yellow-800',
  DEPOSIT: 'bg-blue-100 text-blue-800',
  RELEASE: 'bg-green-100 text-green-800',
};

const entityIcons = {
  Soldier: <Users className="w-4 h-4 text-blue-600" />,
  Weapon: <Target className="w-4 h-4 text-red-600" />,
  SerializedGear: <Wrench className="w-4 h-4 text-purple-600" />,
  DroneSet: <Wrench className="w-4 h-4 text-sky-600" />,
  DroneComponent: <Package className="w-4 h-4 text-orange-600" />,
  Division: <Shield className="w-4 h-4 text-green-600" />,
  default: <Clock className="w-4 h-4 text-slate-500" />,
};

const formatUtcToIsraelTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-GB', { 
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

const processActivityDetails = (details) => {
    if (!details) return { text: '', hasSignature: false };
    
    const signatureRegex = /(data:image\/png;base64,[\s\S]+)/;
    const hasSignature = signatureRegex.test(details);
    
    if (hasSignature) {
        let text = details.replace(signatureRegex, '').replace(/Signature:\s*$/, '').trim();
        text = text.replace(/signature\.(png|jpg|jpeg)/gi, '').trim();
        text = text.replace(/\s*,\s*$/, '').trim();
        return { text, hasSignature: true };
    }
    
    return { text: details, hasSignature: false };
};

// Enhanced function to extract comprehensive activity information
const extractAllActivityItems = (details, context) => {
    const items = {
        soldiers: new Set(),
        serialized: new Set(),
        standard: new Map(), // Using a Map to handle quantities of standard equipment
    };

    const addUniqueSerialized = (item) => {
        if (item) items.serialized.add(item.trim());
    };
    const addUniqueSoldier = (item) => {
        if (item) items.soldiers.add(item.trim());
    };
    const addStandardItem = (type, quantity) => {
        if (type && quantity > 0) {
            const cleanType = type.trim();
            items.standard.set(cleanType, (items.standard.get(cleanType) || 0) + quantity);
        }
    };
    
    // 1. Process context object for more reliable data
    if (context) {
        if (context.deletedRecord) {
            const rec = context.deletedRecord;
            if (rec.soldier_id) addUniqueSoldier(`${rec.first_name || ''} ${rec.last_name || ''} (${rec.soldier_id})`.trim());
            if (rec.weapon_id) addUniqueSerialized(`Weapon: ${rec.weapon_type || ''} (${rec.weapon_id})`);
            if (rec.gear_id) addUniqueSerialized(`Gear: ${rec.gear_type || ''} (${rec.gear_id})`);
            if (rec.set_serial_number) addUniqueSerialized(`Drone Set: ${rec.set_type || ''} (${rec.set_serial_number})`);
            if (rec.component_id) addUniqueSerialized(`Drone Component: ${rec.component_type || ''} (${rec.component_id})`);
            if (rec.equipment_type && rec.quantity) addStandardItem(rec.equipment_type, rec.quantity);
        }
        if (context.changes) {
            Object.entries(context.changes).forEach(([field, value]) => {
                if (field === 'assigned_to' && value.new) addUniqueSoldier(`ID: ${value.new}`);
            });
        }
        if (Array.isArray(context.weaponIds)) context.weaponIds.forEach(id => addUniqueSerialized(`Weapon ID: ${id}`));
        if (Array.isArray(context.gearIds)) context.gearIds.forEach(id => addUniqueSerialized(`Gear ID: ${id}`));
        if (Array.isArray(context.droneSetIds)) context.droneSetIds.forEach(id => addUniqueSerialized(`Drone Set ID: ${id}`));
        if (Array.isArray(context.unassignedItems)) {
            context.unassignedItems.forEach(item => {
                if(item.id) addUniqueSerialized(`${item.type || 'Item'}: ${item.name || ''} (${item.id})`);
                if(item.quantity && item.type) addStandardItem(item.type, item.quantity); // Changed from item.name to item.type for standard items
            });
        }
    }
    
    // 2. Process details string as a fallback
    const detailsText = String(details || '');
    // Match standard equipment like "2 Stretcher" or "2 Stretchers"
    const standardEqMatches = [...detailsText.matchAll(/(\d+)\s+([A-Za-z\s]+?)(?=\s+was|\s+were|\s+to|\s+from|\s*$)/gi)];
    standardEqMatches.forEach(match => {
        const quantity = parseInt(match[1], 10);
        let type = match[2].trim();
        // Remove trailing 's' if it seems like a plural
        if (type.endsWith('s') && type.length > 1 && !['gas'].includes(type.toLowerCase())) { // Added condition to exclude 'gas'
            type = type.slice(0, -1);
        }
        if (!isNaN(quantity)) addStandardItem(type, quantity);
    });
    
    // Also try to extract single items that might not have a quantity prefix but are mentioned as "item_type ID: XXX"
    const serializedPattern = /(weapon|gear|drone set|drone component|item):\s*([A-Za-z0-9\s-]+?\s*\(?[A-Z0-9\-_]+\)?)/gi;
    let serializedMatch;
    while ((serializedMatch = serializedPattern.exec(detailsText)) !== null) {
        addUniqueSerialized(`${serializedMatch[1].charAt(0).toUpperCase() + serializedMatch[1].slice(1)}: ${serializedMatch[2]}`);
    }


    return {
        soldiers: Array.from(items.soldiers),
        serializedItems: Array.from(items.serialized),
        standardEquipment: Array.from(items.standard).map(([type, quantity]) => ({ type, quantity })),
    };
};

// Enhanced function to determine all entity types involved
const getAllInvolvedEntities = (details, context) => {
    const entities = [];
    const detailsText = String(details || '').toLowerCase();
    
    if (context && context.deletedRecord) {
        const record = context.deletedRecord;
        if (record.soldier_id) entities.push('Soldier');
        if (record.weapon_id) entities.push('Weapon');
        if (record.gear_id) entities.push('SerializedGear');
        if (record.set_serial_number) entities.push('DroneSet');
        if (record.component_id) entities.push('DroneComponent');
    }
    
    if (detailsText.includes('soldier') || detailsText.includes('personnel')) entities.push('Soldier');
    if (detailsText.includes('weapon') || detailsText.includes('rifle') || detailsText.includes('gun') || detailsText.includes('firearm')) entities.push('Weapon');
    if (detailsText.includes('gear') || detailsText.includes('vest') || detailsText.includes('helmet')) entities.push('SerializedGear');
    if (detailsText.includes('drone') || detailsText.includes('avetta') || detailsText.includes('evo')) entities.push('DroneSet');
    if (detailsText.includes('component') || detailsText.includes('remote') || detailsText.includes('battery') || detailsText.includes('controller')) entities.push('DroneComponent');
    if (detailsText.includes('equipment') && !detailsText.includes('gear')) entities.push('Equipment');
    if (detailsText.includes('division') || detailsText.includes('unit')) entities.push('Division');
    
    return [...new Set(entities)];
};

const ActivityDetailsDialog = ({ activity, open, onOpenChange }) => {
    if (!activity) return null;
    const { context } = activity;
    const processedDetails = processActivityDetails(activity.details);
    const displayTime = formatUtcToIsraelTime(activity.created_date);
    const allItems = extractAllActivityItems(processedDetails.text, context);
    const allEntities = getAllInvolvedEntities(processedDetails.text, context);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] p-1">
            <div className="space-y-6 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                    <Label className="text-sm font-medium text-slate-600">Action Type</Label>
                    <div className="flex items-center gap-2 mt-1">
                        {activityIcons[activity.activity_type] || activityIcons.default}
                        <Badge className={`${activityTypeColors[activity.activity_type] || 'bg-slate-100 text-slate-800'}`}>
                            {activity.activity_type}
                        </Badge>
                    </div>
                </div>
                
                <div>
                    <Label className="text-sm font-medium text-slate-600">Entity Type</Label>
                    <p className="text-sm text-slate-900 mt-1">{activity.entity_type}</p>
                </div>
              </div>

              {context && context.changes && Object.keys(context.changes).length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <Label className="text-sm font-medium text-orange-900">Changes</Label>
                      <DetailTable className="mt-2 bg-white">
                          <DetailTableHeader>
                              <DetailTableRow>
                                  <DetailTableHead>Field</DetailTableHead>
                                  <DetailTableHead>Old Value</DetailTableHead>
                                  <DetailTableHead>New Value</DetailTableHead>
                              </DetailTableRow>
                          </DetailTableHeader>
                          <DetailTableBody>
                              {Object.entries(context.changes).map(([field, values]) => (
                                  <DetailTableRow key={field}>
                                      <DetailTableCell className="font-medium capitalize">{field.replace(/_/g, ' ')}</DetailTableCell>
                                      <DetailTableCell className="text-red-600">{String(values.old)}</DetailTableCell>
                                      <DetailTableCell className="text-green-600">{String(values.new)}</DetailTableCell>
                                  </DetailTableRow>
                              ))}
                          </DetailTableBody>
                      </DetailTable>
                  </div>
              )}

              {/* Specific sections for involved entities */}
              <div className="space-y-4">
                {allItems.soldiers.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-blue-900">Soldier(s) Involved</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allItems.soldiers.map((item, index) => (
                        <Badge key={index} variant="secondary" className="font-mono text-xs bg-blue-100 text-blue-800">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {allItems.serializedItems.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-purple-900">Serialized Items Involved</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allItems.serializedItems.map((item, index) => (
                        <Badge key={index} variant="secondary" className="font-mono text-xs bg-purple-100 text-purple-800">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {allItems.standardEquipment.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <Label className="text-sm font-medium text-green-900">Standard Equipment Involved</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allItems.standardEquipment.map((item, index) => (
                        <Badge key={index} variant="secondary" className="font-mono text-xs bg-green-100 text-green-800">
                          {item.quantity}x {item.type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Enhanced Entity Types */}
              {allEntities.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <Label className="text-sm font-medium text-indigo-900">Entity Types Involved</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                          {allEntities.map(entity => (
                              <Badge key={entity} variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300">
                                  <div className="mr-1">{entityIcons[entity] || entityIcons.default}</div>
                                  {entity}
                              </Badge>
                          ))}
                      </div>
                  </div>
              )}

              <div>
                  <Label className="text-sm font-medium text-slate-600">Performed By</Label>
                  <p className="text-sm text-slate-900 mt-1">{activity.user_full_name || 'System'}</p>
              </div>

              <div>
                  <Label className="text-sm font-medium text-slate-600">Date & Time</Label>
                  <p className="text-sm text-slate-900 mt-1">{displayTime}</p>
              </div>

              <div>
                  <Label className="text-sm font-medium text-slate-600">Full Description</Label>
                  <div className="bg-slate-50 rounded-lg p-3 mt-1">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{processedDetails.text}</p>
                      {processedDetails.hasSignature && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                              <Badge className="bg-green-100 text-green-800">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Digitally Signed
                              </Badge>
                          </div>
                      )}
                  </div>
              </div>

              {activity.activity_id && (
                  <div>
                      <Label className="text-sm font-medium text-slate-600">Activity ID</Label>
                      <p className="text-xs text-slate-500 font-mono mt-1">{activity.activity_id}</p>
                  </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };


export default function HistoryPage() {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        user: 'all',
        type: 'all',
        entity: 'all',
    });
    const [users, setUsers] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const currentUser = await User.me();
                const isAdmin = currentUser?.role === 'admin';
                const isManager = currentUser?.custom_role === 'manager';
                const userDivision = currentUser?.department;
                
                // Only apply division filter if user is not admin AND not manager AND has a division
                const filter = !isAdmin && !isManager && userDivision ? { division_name: userDivision } : {};

                console.log('History filter applied:', filter, 'User:', currentUser?.full_name, 'Division:', userDivision, 'Is Admin:', isAdmin, 'Is Manager:', isManager);

                const [activityData, userData] = await Promise.all([
                    ActivityLog.filter(filter, '-created_date', 500),
                    User.list()
                ]);
                setActivities(Array.isArray(activityData) ? activityData : []);
                const userNames = [...new Set(activityData.map(a => a.user_full_name).filter(Boolean))];
                setUsers(userNames);
            } catch (error) {
                console.error("Error fetching history:", error);
                setActivities([]);
                setUsers([]);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    const filteredActivities = useMemo(() => {
        return activities.filter(activity => {
            const searchLower = filters.search.toLowerCase();
            // Robust search: details must exist and contain the search string (if search string is not empty)
            const detailsMatch = !searchLower || (activity.details && String(activity.details).toLowerCase().includes(searchLower));
            const userMatch = filters.user === 'all' || activity.user_full_name === filters.user;
            const typeMatch = filters.type === 'all' || activity.activity_type === filters.type;

            const involvedEntities = getAllInvolvedEntities(activity.details, activity.context);
            const entityMatch = filters.entity === 'all' || 
                                involvedEntities.includes(filters.entity) ||
                                activity.entity_type === filters.entity; // Keep original entity_type check as well
            
            return detailsMatch && userMatch && typeMatch && entityMatch;
        });
    }, [activities, filters]);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleActivityClick = (activity) => {
        setSelectedActivity(activity);
        setShowDetailsDialog(true);
    };

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Activity History</h1>
                    <p className="text-slate-600">Review all system activities and events.</p>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Search details..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Action Types</SelectItem>
                                {Object.keys(activityTypeColors).map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filters.entity} onValueChange={(value) => handleFilterChange('entity', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Entity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                {Object.keys(entityIcons).filter(e=>e !== 'default').map(entity => (
                                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filters.user} onValueChange={(value) => handleFilterChange('user', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by User" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map(user => (
                                    <SelectItem key={user} value={user}>{user}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-auto max-h-[70vh]">
                        <Table>
                            <TableHeader className="sticky top-0 z-30 bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[200px]">Date & Time (Israel)</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(10).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredActivities.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                            No activities found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredActivities.map(activity => {
                                      const processedDetails = processActivityDetails(activity.details);
                                      return (
                                        <TableRow 
                                            key={activity.id}
                                            className="cursor-pointer hover:bg-slate-50"
                                            onClick={() => handleActivityClick(activity)}
                                        >
                                            <TableCell className="font-medium text-slate-700 text-xs">
                                                {formatUtcToIsraelTime(activity.created_date)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`font-mono text-xs ${activityTypeColors[activity.activity_type]}`}>
                                                    <div className="mr-2">{activityIcons[activity.activity_type] || activityIcons.default}</div>
                                                    {activity.activity_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-800">
                                                {activity.user_full_name || 'System'}
                                                {activity.user_soldier_id && (
                                                    <span className="text-slate-500 text-xs ml-1">({activity.user_soldier_id})</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {processedDetails.text}
                                                {processedDetails.hasSignature && (
                                                    <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                                                        Signed
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                      );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ActivityDetailsDialog 
                activity={selectedActivity}
                open={showDetailsDialog}
                onOpenChange={setShowDetailsDialog}
            />
        </div>
    );
}
