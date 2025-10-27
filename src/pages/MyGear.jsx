import React, { useState, useEffect } from "react";
import { SerializedGear, Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Binoculars, Package, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyGearPage() {
  const [gear, setGear] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyGear();
  }, []);

  const loadMyGear = async () => {
    setIsLoading(true);
    console.log('[MyGear] STEP 1: Loading gear...');
    try {
      const user = await User.me();
      setCurrentUser(user);
      console.log('[MyGear] STEP 2: Current user loaded:', {
        custom_role: user.custom_role,
        linked_soldier_id: user.linked_soldier_id,
        email: user.email,
        phoneNumber: user.phoneNumber
      });

      if (user.custom_role !== 'soldier') {
        console.log('[MyGear] User is not a soldier, exiting');
        setGear([]);
        setIsLoading(false);
        return;
      }

      // Use linked_soldier_id from custom claims (already available)
      let soldierId = user.linked_soldier_id;

      // Fallback to email/phone lookup only if no linked_soldier_id
      if (!soldierId && user.email) {
        console.log('[MyGear] No linked_soldier_id, trying email lookup...');
        const soldiersByEmail = await Soldier.filter({ email: user.email });
        if (soldiersByEmail && soldiersByEmail.length > 0) {
          soldierId = soldiersByEmail[0].soldier_id;
          console.log('[MyGear] Found soldier by email:', soldierId);
        }
      }

      if (!soldierId && user.phoneNumber) {
        console.log('[MyGear] No soldier found by email, trying phone lookup...');
        const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
        if (soldiersByPhone && soldiersByPhone.length > 0) {
          soldierId = soldiersByPhone[0].soldier_id;
          console.log('[MyGear] Found soldier by phone:', soldierId);
        }
      }

      console.log('[MyGear] STEP 3: Resolved soldier ID:', soldierId);

      if (!soldierId) {
        console.log('[MyGear] ❌ No soldier ID found - cannot load gear');
        setGear([]);
        setIsLoading(false);
        return;
      }

      // Load gear assigned to this soldier
      console.log('[MyGear] STEP 4: Querying gear...');
      console.log('  Query: SerializedGear.filter({ assigned_to:', soldierId, '})');
      const myGear = await SerializedGear.filter({ assigned_to: soldierId });
      console.log('[MyGear] STEP 5: Found gear:', myGear?.length || 0, 'items');
      setGear(Array.isArray(myGear) ? myGear : []);

    } catch (error) {
      console.error("Error loading my gear:", error);
      setGear([]);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading your gear...</div>
      </div>
    );
  }

  if (currentUser?.custom_role !== 'soldier') {
    return (
      <div className="p-6">
        <Alert>
          <Binoculars className="h-4 w-4" />
          <AlertDescription>
            This page is only accessible to soldiers with linked accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const functioningCount = gear.filter(g => g.status === 'functioning').length;
  const notFunctioningCount = gear.filter(g => g.status === 'not_functioning').length;
  const withMeCount = gear.filter(g => g.armory_status === 'with_soldier').length;
  const inDepositCount = gear.filter(g => g.armory_status === 'in_deposit').length;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">My Gear</h1>
        <p className="text-slate-600">
          Serialized gear currently assigned to you
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gear</CardTitle>
            <Binoculars className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gear.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Functioning</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{functioningCount}</div>
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
          <CardTitle>Gear Details</CardTitle>
        </CardHeader>
        <CardContent>
          {gear.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Binoculars className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>No gear is currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gear.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{item.gear_type}</h3>
                    <p className="text-sm text-slate-600 font-mono">ID: {item.gear_id}</p>
                    {item.division_name && (
                      <p className="text-sm text-slate-600">Division: {item.division_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${
                      item.status === 'functioning' ? 
                      'bg-green-100 text-green-800 border-green-200' : 
                      'bg-red-100 text-red-800 border-red-200'
                    } border`}>
                      {item.status === 'functioning' ? 'Functioning' : 'Not Functioning'}
                    </Badge>
                    <Badge className={`${
                      item.armory_status === 'with_soldier' ? 
                      'bg-blue-100 text-blue-800 border-blue-200' : 
                      'bg-amber-100 text-amber-800 border-amber-200'
                    } border`}>
                      {item.armory_status === 'with_soldier' ? 'With Me' : 'In Deposit'}
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