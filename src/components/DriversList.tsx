import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Driver, DocumentType } from '../types';
import { UserSquare2, Search, Plus, UserPlus, X, Phone, Shield } from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';
export const DriversList: React.FC = () => {
  const { t } = useI18n();
  const { drivers, addDriver } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const [newDriverForm, setNewDriverForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '1992-06-20',
    drivingLicense: '',
    docType: 'CIN' as DocumentType,
    docNumber: '',
    phone: '',
    email: '',
    notes: '',
  });

  const filteredDrivers = drivers.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      d.firstName.toLowerCase().includes(q) ||
      d.lastName.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      d.docNumber.toLowerCase().includes(q) ||
      d.drivingLicense.toLowerCase().includes(q)
    );
  });

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverForm.firstName || !newDriverForm.lastName || !newDriverForm.docNumber || !newDriverForm.drivingLicense || !newDriverForm.phone) {
      alert(t('Veuillez remplir tous les champs obligatoires'));
      return;
    }

    addDriver(newDriverForm);
    setIsAddModalOpen(false);
    setNewDriverForm({
      firstName: '',
      lastName: '',
      birthDate: '1992-06-20',
      drivingLicense: '',
      docType: 'CIN',
      docNumber: '',
      phone: '',
      email: '',
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-widest font-mono">
            <UserSquare2 className="w-4 h-4" />
            {t('Module Conducteurs Agréés • Section 8')}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            {t('Répertoire des Conducteurs Secondaires')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('Conducteurs additionnels agréés pouvant être associés aux contrats de location Morvello.')}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {t('+ Nouveau Conducteur')}
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Rechercher par nom, prénom, téléphone, document, permis...')}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl ps-9 pe-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
          {t('{filteredDriversCount} conducteur(s)', { filteredDriversCount: filteredDrivers.length })}
        </span>
      </div>

      {/* DRIVERS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((drv) => (
          <div
            key={drv.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md hover:border-slate-700 transition-colors space-y-2.5"
          >
            <div className="flex items-start justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-xs font-bold text-white uppercase">
                  {drv.lastName} {drv.firstName}
                </h3>
                <p className="text-[10px] text-slate-400">{t('Né(e) le {birthDate}', { birthDate: drv.birthDate })}</p>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                {drv.docType}
              </span>
            </div>

            <div className="text-xs space-y-1 text-slate-300">
              <p>
                <span className="text-slate-500">{t('N° Document :')}</span>{' '}
                <strong className="text-white font-mono">{drv.docNumber}</strong>
              </p>
              <p>
                <span className="text-slate-500">{t('Permis N° :')}</span>{' '}
                <strong className="text-white font-mono">{drv.drivingLicense}</strong>
              </p>
              <p>
                <span className="text-slate-500">{t('GSM / Tél :')}</span>{' '}
                <strong className="text-amber-400">{drv.phone}</strong>
              </p>
            </div>

            {drv.notes && (
              <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 italic">
                {drv.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* MODAL AJOUT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">{t('Nouveau Conducteur Agréé')}</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('Prénom *')}</label>
                  <input
                    type="text"
                    required
                    value={newDriverForm.firstName}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('Nom *')}</label>
                  <input
                    type="text"
                    required
                    value={newDriverForm.lastName}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('Date de naissance *')}</label>
                  <input
                    type="date"
                    required
                    value={newDriverForm.birthDate}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('Type de Document *')}</label>
                  <select
                    value={newDriverForm.docType}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, docType: e.target.value as DocumentType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CIN">C.I.N</option>
                    <option value="Passeport">{t('Passeport')}</option>
                    <option value="Carte de Séjour">{t('Carte de Séjour')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{t('N° Document *')}</label>
                  <input
                    type="text"
                    required
                    value={newDriverForm.docNumber}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, docNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{t('N° Permis de Conduire *')}</label>
                  <input
                    type="text"
                    required
                    value={newDriverForm.drivingLicense}
                    onChange={(e) => setNewDriverForm({ ...newDriverForm, drivingLicense: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('Téléphone / GSM *')}</label>
                <input
                  type="tel"
                  required
                  placeholder="+212 6..."
                  value={newDriverForm.phone}
                  onChange={(e) => setNewDriverForm({ ...newDriverForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t('Remarques')}</label>
                <input
                  type="text"
                  placeholder={t('Lien de parenté ou note particulière')}
                  value={newDriverForm.notes}
                  onChange={(e) => setNewDriverForm({ ...newDriverForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  {t('Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95"
                >
                  {t('Enregistrer le Conducteur')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
