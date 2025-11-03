
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, User, Wrench, Target, CheckCircle, Edit, Trash2, Joystick, Binoculars, PlusCircle, Shield, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from "@/components/ui/button";

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

const formatUtcToIsraelTime = (utcDateString) => {
  if (!utcDateString) return 'Unknown Time';
  try {
    const date = new Date(utcDateString);
    // Add 3 hours to the UTC time
    date.setUTCHours(date.getUTCHours() + 3);
    // Format to a clear, absolute time string
    return format(date, "dd MMM yyyy, HH:mm:ss 'IST'");
  } catch (error) {
    return 'Invalid Date';
  }
};

const processActivityDetails = (details) => {
    if (!details) return { text: '', hasSignature: false };
    
    // Handle object details (e.g., error messages)
    if (typeof details === 'object' && details !== null) {
        // If it has a message property, use that
        if (details.message) {
            return { text: String(details.message), hasSignature: false };
        }
        // Otherwise, try to stringify it
        return { text: JSON.stringify(details), hasSignature: false };
    }
    
    // Convert to string to ensure it's safe to process
    const detailsStr = String(details);
    
    const signatureRegex = /(data:image\/png;base64,[\s\S]+)/;
    const hasSignature = signatureRegex.test(detailsStr);
    
    if (hasSignature) {
        // Remove the signature data completely and clean up the text
        let text = detailsStr.replace(signatureRegex, '').replace(/Signature:\s*$/, '').trim();
        // Remove any remaining filename references like "signature.png" or similar
        text = text.replace(/signature\.(png|jpg|jpeg)/gi, '').trim();
        // Clean up any leftover punctuation
        text = text.replace(/\s*,\s*$/, '').trim();
        return { text, hasSignature: true };
    }
    
    return { text: detailsStr, hasSignature: false };
};

// Enhanced function to extract comprehensive activity information  
const extractAllActivityItems = (details, context) => {
    const items = {
        soldiers: new Set(),
        weapons: new Set(),
        gear: new Set(),
        droneSets: new Set(),
        droneComponents: new Set(),
        other: new Set(),
    };

    const addUnique = (set, item) => {
        if (item) {
            const cleanedItem = String(item).trim();
            if (cleanedItem) set.add(cleanedItem);
        }
    };

    // 1. Process details string
    if (details) {
        // General pattern for "Type Name (ID)"
        const generalPattern = /(soldier|weapon|gear|drone set|drone component|equipment)\s+([A-Za-z0-9\s\-_'"]+?)\s+\(([A-Z0-9\-_]+)\)/gi;
        let match;
        while ((match = generalPattern.exec(details)) !== null) {
            const [, type, name, id] = match;
            const fullItem = `${name.trim()} (${id.trim()})`;
            if (type.toLowerCase().includes('soldier')) addUnique(items.soldiers, fullItem);
            else if (type.toLowerCase().includes('weapon')) addUnique(items.weapons, fullItem);
            else if (type.toLowerCase().includes('gear')) addUnique(items.gear, fullItem);
            else if (type.toLowerCase().includes('drone set')) addUnique(items.droneSets, fullItem);
            else if (type.toLowerCase().includes('drone component')) addUnique(items.droneComponents, fullItem);
            else addUnique(items.other, fullItem);
        }

        // Simpler patterns for items without names
        const idOnlyPatterns = [
            { regex: /weapon.*?\(?([A-Z0-9\-]{4,})\)?/gi, set: items.weapons },
            { regex: /gear.*?\(?([A-Z0-9\-]{4,})\)?/gi, set: items.gear },
            { regex: /drone set.*?\(?([A-Z0-9\-]{4,})\)?/gi, set: items.droneSets },
            { regex: /component.*?\(?([A-Z0-9\-]{4,})\)?/gi, set: items.droneComponents },
            { regex: /soldier.*?\(?([A-Z0-9\-]{4,})\)?/gi, set: items.soldiers },
        ];

        idOnlyPatterns.forEach(({ regex, set }) => {
            let idMatch;
            while ((idMatch = regex.exec(details)) !== null) {
                // Check if this ID is part of an already-captured full item
                const isCaptured = Array.from(set).some(item => item.includes(`(${idMatch[1]})`));
                if (!isCaptured) addUnique(set, idMatch[1]);
            }
        });
    }

    // 2. Process context object for more reliable data
    if (context) {
        if (context.deletedRecord) {
            const rec = context.deletedRecord;
            if (rec.soldier_id) addUnique(items.soldiers, `${rec.first_name || ''} ${rec.last_name || ''} (${rec.soldier_id})`.trim());
            if (rec.weapon_id) addUnique(items.weapons, `${rec.weapon_type || 'Weapon'} (${rec.weapon_id})`);
            if (rec.gear_id) addUnique(items.gear, `${rec.gear_type || 'Gear'} (${rec.gear_id})`);
            if (rec.set_serial_number) addUnique(items.droneSets, `${rec.set_type || 'Drone Set'} (${rec.set_serial_number})`);
            if (rec.component_id) addUnique(items.droneComponents, `${rec.component_type || 'Component'} (${rec.component_id})`);
        }
        if (context.changes) {
            Object.entries(context.changes).forEach(([field, value]) => {
                if (field === 'assigned_to' && value.new) addUnique(items.soldiers, `Assigned to ${value.new}`);
            });
        }
        if (Array.isArray(context.weaponIds)) context.weaponIds.forEach(id => addUnique(items.weapons, `Weapon ID: ${id}`));
        if (Array.isArray(context.gearIds)) context.gearIds.forEach(id => addUnique(items.gear, `Gear ID: ${id}`));
        if (Array.isArray(context.droneSetIds)) context.droneSetIds.forEach(id => addUnique(items.droneSets, `Drone Set ID: ${id}`));
    }

    // Convert Sets to Arrays
    return {
        soldiers: Array.from(items.soldiers),
        weapons: Array.from(items.weapons),
        gear: Array.from(items.gear),
        droneSets: Array.from(items.droneSets),
        droneComponents: Array.from(items.droneComponents),
        other: Array.from(items.other),
    };
};


const getAllInvolvedEntities = (details, context) => {
    return [];
};


export default function RecentActivity({ activities, isLoading }) {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleActivityClick = (activity) => {
    setSelectedActivity(activity);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasMoreActivities = Array.isArray(activities) && activities.length > 5;
  const displayedActivities = showAll ? activities : (Array.isArray(activities) ? activities.slice(0, 5) : []);

  return (
    <>
      <Card className="border-slate-200 shadow-sm transition-all duration-300">
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-slate-900 text-base md:text-lg">
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="space-y-2 md:space-y-3">
            {!Array.isArray(activities) || activities.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <Clock className="w-8 h-8 md:w-12 md:h-12 text-slate-300 mx-auto mb-2 md:mb-3" />
                <p className="text-sm md:text-base text-slate-500">No recent activity logged.</p>
              </div>
            ) : (
              displayedActivities.map((activity) => {
                const Icon = activityIcons[activity.activity_type] || activityIcons.default;
                const processedDetails = processActivityDetails(activity.details);
                const displayTime = formatUtcToIsraelTime(activity.created_date);
                const performedBy = activity.user_full_name
                  ? `${activity.user_full_name} ${activity.user_soldier_id ? `(${activity.user_soldier_id})` : ''}`
                  : 'System';

                return (
                  <div 
                    key={activity.id} 
                    onClick={() => handleActivityClick(activity)}
                    className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors duration-200"
                  >
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-white rounded-full flex items-center justify-center border border-slate-200 shrink-0 mt-0.5 md:mt-1">
                      {Icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-slate-800 line-clamp-2">{processedDetails.text}</p>
                      <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1 flex-wrap">
                        <p className="text-[10px] md:text-xs text-slate-500">
                          by {performedBy}
                        </p>
                        <Badge variant="outline" className="text-[10px] md:text-xs font-normal px-1.5 py-0.5 shrink-0">
                          {displayTime}
                        </Badge>
                        {processedDetails.hasSignature && (
                          <Badge className="text-[10px] md:text-xs bg-green-100 text-green-800 font-normal px-1.5 py-0.5">
                            Signed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {hasMoreActivities && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="w-full h-8 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 mt-4 transition-all"
            >
              {showAll ? (
                <>
                  Show Less <ChevronUp className="w-3 h-3 ml-1" />
                </>
              ) : (
                <>
                  Show All ({activities.length - 5} more) <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Activity Details</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-4">
                        {selectedActivity && (() => {
                            const { context } = selectedActivity;
                            const processedDetails = processActivityDetails(selectedActivity.details);
                            const displayTime = formatUtcToIsraelTime(selectedActivity.created_date);
                            const performedBy = selectedActivity.user_full_name
                              ? `${selectedActivity.user_full_name} ${selectedActivity.user_soldier_id ? `(${selectedActivity.user_soldier_id})` : ''}`
                              : 'System';
                            
                            const allItems = extractAllActivityItems(selectedActivity.details, context);
                            const allEntities = getAllInvolvedEntities(processedDetails.text, context);
                            
                            return (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-slate-600">Action Type</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                {activityIcons[selectedActivity.activity_type] || activityIcons.default}
                                                <Badge className={`${
                                                    selectedActivity.activity_type === 'CREATE' ? 'bg-green-100 text-green-800' :
                                                    selectedActivity.activity_type === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                    selectedActivity.activity_type === 'DELETE' ? 'bg-red-100 text-red-800' :
                                                    selectedActivity.activity_type === 'ASSIGN' ? 'bg-indigo-100 text-indigo-800' :
                                                    selectedActivity.activity_type === 'UNASSIGN' ? 'bg-orange-100 text-orange-800' :
                                                    selectedActivity.activity_type === 'INSPECT' ? 'bg-yellow-100 text-yellow-800' :
                                                    selectedActivity.activity_type === 'DEPOSIT' ? 'bg-blue-100 text-blue-800' :
                                                    selectedActivity.activity_type === 'RELEASE' ? 'bg-green-100 text-green-800' :
                                                    'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {selectedActivity.activity_type}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <Label className="text-sm font-medium text-slate-600">Entity Type</Label>
                                            <p className="text-sm text-slate-900 mt-1">{selectedActivity.entity_type}</p>
                                        </div>
                                    </div>

                                    {context && context.changes && Object.keys(context.changes).length > 0 && (
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <Label className="text-sm font-medium text-orange-900">Changes</Label>
                                            <Table className="mt-2 bg-white rounded-md overflow-hidden">
                                                <TableHeader className="bg-orange-100">
                                                    <TableRow>
                                                        <TableHead className="py-2 text-orange-800">Field</TableHead>
                                                        <TableHead className="py-2 text-orange-800">Old Value</TableHead>
                                                        <TableHead className="py-2 text-orange-800">New Value</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {Object.entries(context.changes).map(([field, values]) => (
                                                        <TableRow key={field}>
                                                            <TableCell className="font-medium text-slate-700">{field.replace(/_/g, ' ')}</TableCell>
                                                            <TableCell className="text-red-600">{String(values.old)}</TableCell>
                                                            <TableCell className="text-green-600">{String(values.new)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    {context && context.unassignedItems && context.unassignedItems.length > 0 && (
                                         <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                            <Label className="text-sm font-medium text-indigo-900">Unassigned Items</Label>
                                             <ul className="mt-2 space-y-1 list-disc list-inside">
                                                 {context.unassignedItems.map((item, index) => (
                                                     <li key={index} className="text-sm text-indigo-800">
                                                         {item.type && <strong>{item.type}: </strong>}
                                                         {item.name && <span>{item.name} </span>}
                                                         {item.id && <code className="text-xs bg-indigo-100 p-1 rounded">{item.id}</code>}
                                                         {item.quantity && <span> (Quantity: {item.quantity})</span>}
                                                     </li>
                                                 ))}
                                             </ul>
                                         </div>
                                    )}

                                    {/* Enhanced All Items Section */}
                                    {(allItems.soldiers.length > 0 || allItems.weapons.length > 0 || allItems.gear.length > 0 || 
                                      allItems.droneSets.length > 0 || allItems.droneComponents.length > 0 || allItems.other.length > 0) && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <Label className="text-sm font-medium text-blue-900">All Associated Items</Label>
                                            <div className="mt-3 space-y-3">
                                                {allItems.soldiers.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Soldiers:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.soldiers.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {allItems.weapons.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Weapons:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.weapons.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {allItems.gear.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Gear:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.gear.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {allItems.droneSets.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Drone Sets:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.droneSets.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {allItems.droneComponents.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-pink-700 uppercase tracking-wide">Drone Components:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.droneComponents.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {allItems.other.length > 0 && (
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Other Items:</span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {allItems.other.map((item, index) => (
                                                                <Badge key={index} variant="secondary" className="font-mono text-xs">
                                                                    {item}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <Label className="text-sm font-medium text-slate-600">Performed By</Label>
                                        <p className="text-sm text-slate-900 mt-1">{performedBy}</p>
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

                                    {selectedActivity.activity_id && (
                                        <div>
                                            <Label className="text-sm font-medium text-slate-600">Activity ID</Label>
                                            <p className="text-xs text-slate-500 font-mono mt-1">{selectedActivity.activity_id}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
    </>
  );
}
