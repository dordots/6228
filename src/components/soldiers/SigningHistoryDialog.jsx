import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityLog, User } from "@/api/entities";
import { generateSigningForm } from "@/api/functions";
import { generateReleaseForm } from "@/api/functions";
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight } from 'lucide-react';

const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const activityTypeColors = {
  ASSIGN: 'bg-green-100 text-green-800 border-green-200',
  UNASSIGN: 'bg-orange-100 text-orange-800 border-orange-200',
  RELEASE: 'bg-red-100 text-red-800 border-red-200'
};

export default function SigningHistoryDialog({ soldier, open, onOpenChange }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewingForm, setViewingForm] = useState(null);

    useEffect(() => {
        if (soldier && open) {
            const fetchHistory = async () => {
                setIsLoading(true);
                try {
                    console.log(`Searching for history for soldier ${soldier.soldier_id}`);

                    // Get current user to check their division and scope
                    const currentUser = await User.me();
                    console.log(`Current user division: ${currentUser.division}, scope: ${currentUser.scope}`);

                    // Filter activity logs by division if user is not admin
                    // We need to fetch from server with division filter to satisfy Firestore rules
                    let allLogs;
                    if (currentUser.role === 'admin' || currentUser.scope === 'global') {
                        // Admins can see all logs
                        allLogs = await ActivityLog.list("-created_date", 200);
                    } else if (currentUser.division) {
                        // For division managers and team leaders, filter by division
                        // Use the same method as History.jsx
                        allLogs = await ActivityLog.filter(
                            { division_name: currentUser.division },
                            '-created_at',
                            200
                        );
                    } else {
                        console.warn('User has no division assigned, cannot fetch activity logs');
                        allLogs = [];
                    }
                    console.log(`Found ${allLogs.length} total activity logs from division`);
                    
                    // Filter locally to find any mention of this soldier
                    const relevantLogs = allLogs.filter(log => {
                        if (!log) return false;
                        
                        // Method 1: Direct soldier_id field match
                        if (log.soldier_id === soldier.soldier_id) {
                            console.log(`Found direct match for soldier_id: ${log.id}`);
                            return true;
                        }
                        
                        // Method 2: Check context.soldierId
                        if (log.context && log.context.soldierId === soldier.soldier_id) {
                            console.log(`Found context match for soldier_id: ${log.id}`);
                            return true;
                        }
                        
                        // Method 3: Check if soldier ID appears in details text
                        if (log.details) {
                            const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
                            if (detailsStr.includes(soldier.soldier_id)) {
                                console.log(`Found details match for soldier_id: ${log.id}`);
                                return true;
                            }
                        }

                        // Method 4: Check if soldier name appears in details
                        if (log.details) {
                            const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
                            if (detailsStr.includes(soldier.first_name) && detailsStr.includes(soldier.last_name)) {
                                console.log(`Found name match in details: ${log.id}`);
                                return true;
                            }
                        }
                        
                        return false;
                    });
                    
                    console.log(`Found ${relevantLogs.length} relevant logs for soldier ${soldier.soldier_id}`);
                    
                    // Filter for equipment-related activities only
                    const equipmentLogs = relevantLogs.filter(log => 
                        ['ASSIGN', 'UNASSIGN', 'RELEASE', 'CREATE', 'UPDATE'].includes(log.activity_type) &&
                        (log.entity_type === 'Soldier' || log.entity_type === 'Equipment' || log.entity_type === 'Weapon' || log.entity_type === 'SerializedGear' || log.entity_type === 'DroneSet')
                    );
                    
                    console.log(`Filtered to ${equipmentLogs.length} equipment-related logs`);
                    
                    setHistory(equipmentLogs || []);
                } catch (error) {
                    console.error("Error fetching signing history:", error);
                    setHistory([]);
                }
                setIsLoading(false);
            };
            fetchHistory();
        }
    }, [soldier, open]);

    const handleViewForm = async (activity) => {
        setViewingForm(activity.id);
        try {
            let response;
            const params = { activityId: activity.id, fallback_soldier_id: soldier.soldier_id };

            if (activity.activity_type === 'ASSIGN') {
                response = await generateSigningForm(params);
            } else { // UNASSIGN or RELEASE
                response = await generateReleaseForm(params);
            }

            const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 100);

        } catch (error) {
            console.error("Error generating form:", error);
            alert("Failed to generate form.");
        }
        setViewingForm(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Signing History: {soldier?.first_name} {soldier?.last_name}</DialogTitle>
                    <DialogDescription>
                        Review of all equipment assignment and release events for this soldier (ID: {soldier?.soldier_id}).
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4 mt-4">
                    <div className="space-y-4">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
                        ) : history.length === 0 ? (
                            <div className="text-slate-500 text-center py-10">
                                <p>No signing or release history found for soldier ID: {soldier?.soldier_id}</p>
                                <p className="text-xs mt-2">Check the browser console for debugging info.</p>
                            </div>
                        ) : (
                            history.map(log => (
                                <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <Badge className={activityTypeColors[log.activity_type] || 'bg-slate-100 text-slate-800'}>{log.activity_type}</Badge>
                                            <p className="font-medium text-sm text-slate-800">{log.details}</p>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {formatDisplayDate(log.created_date)} by {log.user_full_name || 'System'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Entity: {log.entity_type} | Activity ID: {log.id}
                                        </p>
                                    </div>
                                    {(log.activity_type === 'ASSIGN' || log.activity_type === 'RELEASE' || log.activity_type === 'UNASSIGN') && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewForm(log)}
                                            disabled={viewingForm === log.id}
                                            className="ml-4"
                                        >
                                            {viewingForm === log.id ? "Loading..." : "View Form"}
                                            <ArrowUpRight className="w-3 h-3 ml-2" />
                                        </Button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}