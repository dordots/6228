import React, { useState, useEffect } from "react";
import { Weapon, Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Package, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyWeaponsPage() {
  const [weapons, setWeapons] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyWeapons();
  }, []);

  const loadMyWeapons = async () => {
    setIsLoading(true);
    console.log('[MyWeapons] STEP 1: Loading weapons...');
    try {
      const user = await User.me();
      setCurrentUser(user);
      console.log('[MyWeapons] STEP 2: Current user loaded:', {
        custom_role: user.custom_role,
        linked_soldier_id: user.linked_soldier_id,
        email: user.email,
        phoneNumber: user.phoneNumber
      });

      if (user.custom_role !== 'soldier') {
        console.log('[MyWeapons] User is not a soldier, exiting');
        setWeapons([]);
        setIsLoading(false);
        return;
      }

      // Use linked_soldier_id from custom claims (already available)
      let soldierId = user.linked_soldier_id;

      // Fallback to email/phone lookup only if no linked_soldier_id
      if (!soldierId && user.email) {
        console.log('[MyWeapons] No linked_soldier_id, trying email lookup...');
        const soldiersByEmail = await Soldier.filter({ email: user.email });
        if (soldiersByEmail && soldiersByEmail.length > 0) {
          soldierId = soldiersByEmail[0].soldier_id;
          console.log('[MyWeapons] Found soldier by email:', soldierId);
        }
      }

      if (!soldierId && user.phoneNumber) {
        console.log('[MyWeapons] No soldier found by email, trying phone lookup...');
        const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
        if (soldiersByPhone && soldiersByPhone.length > 0) {
          soldierId = soldiersByPhone[0].soldier_id;
          console.log('[MyWeapons] Found soldier by phone:', soldierId);
        }
      }

      console.log('[MyWeapons] STEP 3: Resolved soldier ID:', soldierId);

      if (!soldierId) {
        console.log('[MyWeapons] ❌ No soldier ID found - cannot load weapons');
        setWeapons([]);
        setIsLoading(false);
        return;
      }

      // Load weapons assigned to this soldier
      console.log('[MyWeapons] STEP 4: Querying weapons...');
      console.log('  Query: Weapon.filter({ assigned_to:', soldierId, '})');
      const myWeapons = await Weapon.filter({ assigned_to: soldierId });
      console.log('[MyWeapons] STEP 5: Found weapons:', myWeapons?.length || 0, 'items');
      setWeapons(Array.isArray(myWeapons) ? myWeapons : []);

    } catch (error) {
      console.error("Error loading my weapons:", error);
      setWeapons([]);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading your weapons...</div>
      </div>
    );
  }

  if (currentUser?.custom_role !== 'soldier') {
    return (
      <div className="p-6">
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            This page is only accessible to soldiers with linked accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const functioningCount = weapons.filter(w => w.status === 'functioning').length;
  const notFunctioningCount = weapons.filter(w => w.status === 'not_functioning').length;
  const withMeCount = weapons.filter(w => w.armory_status === 'with_soldier').length;
  const inDepositCount = weapons.filter(w => w.armory_status === 'in_deposit').length;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">My Weapons</h1>
        <p className="text-slate-600">
          Weapons currently assigned to you
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Weapons</CardTitle>
            <Target className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weapons.length}</div>
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
          <CardTitle>Weapon Details</CardTitle>
        </CardHeader>
        <CardContent>
          {weapons.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>No weapons are currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weapons.map((weapon) => (
                <div key={weapon.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{weapon.weapon_type}</h3>
                    <p className="text-sm text-slate-600 font-mono">ID: {weapon.weapon_id}</p>
                    {weapon.division_name && (
                      <p className="text-sm text-slate-600">Division: {weapon.division_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${
                      weapon.status === 'functioning' ? 
                      'bg-green-100 text-green-800 border-green-200' : 
                      'bg-red-100 text-red-800 border-red-200'
                    } border`}>
                      {weapon.status === 'functioning' ? 'Functioning' : 'Not Functioning'}
                    </Badge>
                    <Badge className={`${
                      weapon.armory_status === 'with_soldier' ? 
                      'bg-blue-100 text-blue-800 border-blue-200' : 
                      'bg-amber-100 text-amber-800 border-amber-200'
                    } border`}>
                      {weapon.armory_status === 'with_soldier' ? 'With Me' : 'In Deposit'}
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