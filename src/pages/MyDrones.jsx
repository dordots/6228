import React, { useState, useEffect } from "react";
import { DroneSet, Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Joystick, Package, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyDronesPage() {
  const [droneSets, setDroneSets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyDrones();
  }, []);

  const loadMyDrones = async () => {
    setIsLoading(true);
    console.log('[MyDrones] STEP 1: Loading drone sets...');
    try {
      const user = await User.me();
      setCurrentUser(user);
      console.log('[MyDrones] STEP 2: Current user loaded:', {
        custom_role: user.custom_role,
        linked_soldier_id: user.linked_soldier_id,
        email: user.email,
        phoneNumber: user.phoneNumber
      });

      if (user.custom_role !== 'soldier') {
        console.log('[MyDrones] User is not a soldier, exiting');
        setDroneSets([]);
        setIsLoading(false);
        return;
      }

      // Use linked_soldier_id from custom claims (already available)
      let soldierId = user.linked_soldier_id;

      // Fallback to email/phone lookup only if no linked_soldier_id
      if (!soldierId && user.email) {
        console.log('[MyDrones] No linked_soldier_id, trying email lookup...');
        const soldiersByEmail = await Soldier.filter({ email: user.email });
        if (soldiersByEmail && soldiersByEmail.length > 0) {
          soldierId = soldiersByEmail[0].soldier_id;
          console.log('[MyDrones] Found soldier by email:', soldierId);
        }
      }

      if (!soldierId && user.phoneNumber) {
        console.log('[MyDrones] No soldier found by email, trying phone lookup...');
        const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
        if (soldiersByPhone && soldiersByPhone.length > 0) {
          soldierId = soldiersByPhone[0].soldier_id;
          console.log('[MyDrones] Found soldier by phone:', soldierId);
        }
      }

      console.log('[MyDrones] STEP 3: Resolved soldier ID:', soldierId);

      if (!soldierId) {
        console.log('[MyDrones] ❌ No soldier ID found - cannot load drone sets');
        setDroneSets([]);
        setIsLoading(false);
        return;
      }

      // Load drone sets assigned to this soldier
      console.log('[MyDrones] STEP 4: Querying drone sets...');
      console.log('  Query: DroneSet.filter({ assigned_to:', soldierId, '})');
      const myDrones = await DroneSet.filter({ assigned_to: soldierId });
      console.log('[MyDrones] STEP 5: Found drone sets:', myDrones?.length || 0, 'items');
      setDroneSets(Array.isArray(myDrones) ? myDrones : []);

    } catch (error) {
      console.error("Error loading my drones:", error);
      setDroneSets([]);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading your drone sets...</div>
      </div>
    );
  }

  if (currentUser?.custom_role !== 'soldier') {
    return (
      <div className="p-6">
        <Alert>
          <Joystick className="h-4 w-4" />
          <AlertDescription>
            This page is only accessible to soldiers with linked accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const operationalCount = droneSets.filter(d => d.status === 'Operational').length;
  const maintenanceCount = droneSets.filter(d => d.status !== 'Operational').length;
  const withMeCount = droneSets.filter(d => d.armory_status === 'with_soldier').length;
  const inDepositCount = droneSets.filter(d => d.armory_status === 'in_deposit').length;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">My Drone Sets</h1>
        <p className="text-slate-600">
          Drone sets currently assigned to you
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sets</CardTitle>
            <Joystick className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{droneSets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operational</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{operationalCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Me</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{withMeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Deposit</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{inDepositCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drone Set Details</CardTitle>
        </CardHeader>
        <CardContent>
          {droneSets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Joystick className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>No drone sets are currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {droneSets.map((droneSet) => (
                <div key={droneSet.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{droneSet.set_type} Drone Set</h3>
                    <p className="text-sm text-slate-600 font-mono">Serial: {droneSet.set_serial_number}</p>
                    {droneSet.division_name && (
                      <p className="text-sm text-slate-600">Division: {droneSet.division_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${
                      droneSet.status === 'Operational' ? 
                      'bg-green-100 text-green-800 border-green-200' : 
                      'bg-red-100 text-red-800 border-red-200'
                    } border`}>
                      {droneSet.status}
                    </Badge>
                    <Badge className={`${
                      droneSet.armory_status === 'with_soldier' ? 
                      'bg-blue-100 text-blue-800 border-blue-200' : 
                      'bg-amber-100 text-amber-800 border-amber-200'
                    } border`}>
                      {droneSet.armory_status === 'with_soldier' ? 'With Me' : 'In Deposit'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}