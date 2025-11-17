const depositLocationLabels = {
  division_deposit: 'Division',
  armory_deposit: 'Armory',
  naura_deposit: 'Naura'
};

export const getArmoryStatusDisplay = (status, depositLocation) => {
  if (!status) {
    return {
      label: 'Unknown',
      className: 'text-slate-700 bg-slate-100 border-slate-200',
      tone: 'unknown'
    };
  }

  if (status === 'with_soldier') {
    return {
      label: 'With Soldier',
      className: 'text-green-800 bg-green-50 border-green-200',
      tone: 'with_soldier'
    };
  }

  if (status === 'in_deposit') {
    if (depositLocation === 'naura_deposit') {
      return {
        label: 'Naura',
        className: 'text-indigo-900 bg-indigo-50 border-indigo-200',
        tone: 'naura'
      };
    }

    const locationLabel = depositLocation ? depositLocationLabels[depositLocation] : null;

    return {
      label: locationLabel ? `${locationLabel} Deposit` : 'In Deposit',
      className: 'text-amber-800 bg-amber-50 border-amber-200',
      tone: 'deposit'
    };
  }

  return {
    label: String(status).replace(/_/g, ' '),
    className: 'text-slate-700 bg-slate-100 border-slate-200',
    tone: 'other'
  };
};

export const getDepositLocationLabel = (depositLocation) => {
  if (!depositLocation) return null;
  return depositLocationLabels[depositLocation] || null;
};

