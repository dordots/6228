import React, { useState, useEffect } from "react";
import { Equipment, Soldier } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Package, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyEquipmentPage() {
  const [equipment, setEquipment] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMyEquipment();
  }, []);

  const loadMyEquipment = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      if (user.custom_role !== 'soldier') {
        setEquipment([]);
        setIsLoading(false);
        return;
      }

      // Find soldier by matching email or phone
      let soldierId = null;

      if (user.email) {
        const soldiersByEmail = await Soldier.filter({ email: user.email });
        if (soldiersByEmail && soldiersByEmail.length > 0) {
          soldierId = soldiersByEmail[0].soldier_id;
        }
      }

      if (!soldierId && user.phoneNumber) {
        const soldiersByPhone = await Soldier.filter({ phone_number: user.phoneNumber });
        if (soldiersByPhone && soldiersByPhone.length > 0) {
          soldierId = soldiersByPhone[0].soldier_id;
        }
      }

      if (!soldierId) {
        setEquipment([]);
        setIsLoading(false);
        return;
      }

      // Load equipment assigned to this soldier
      const myEquipment = await Equipment.filter({ assigned_to: soldierId });
      setEquipment(Array.isArray(myEquipment) ? myEquipment : []);

    } catch (error) {
      console.error("Error loading my equipment:", error);
      setEquipment([]);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading your equipment...</div>
      </div>
    );
  }

  if (currentUser?.custom_role !== 'soldier') {
    return (
      <div className="p-6">
        <Alert>
          <Package className="h-4 w-4" />
          <AlertDescription>
            This page is only accessible to soldiers with linked accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const functioningCount = equipment.filter(e => e.condition === 'functioning').length;
  const notFunctioningCount = equipment.filter(e => e.condition === 'not_functioning').length;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">My Equipment</h1>
        <p className="text-slate-600">
          Equipment currently assigned to you
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Equipment</CardTitle>
            <Wrench className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipment.length}</div>
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
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{notFunctioningCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Details</CardTitle>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p>No equipment is currently assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {equipment.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{item.equipment_type}</h3>
                    {item.serial_number && (
                      <p className="text-sm text-slate-600 font-mono">Serial: {item.serial_number}</p>
                    )}
                    <p className="text-sm text-slate-600">Quantity: {item.quantity || 1}</p>
                    {item.division_name && (
                      <p className="text-sm text-slate-600">Division: {item.division_name}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`${
                      item.condition === 'functioning' ? 
                      'bg-green-100 text-green-800 border-green-200' : 
                      'bg-red-100 text-red-800 border-red-200'
                    } border`}>
                      {item.condition === 'functioning' ? 'Functioning' : 'Not Functioning'}
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