import React from 'react';
import { Client, Driver, DocumentType } from '../../types';
import { ClientDocumentUpload } from '../ClientDocumentUpload';
import { User, Search, Users, UserCheck } from 'lucide-react';

export interface NewClientFormData {
  firstName: string;
  lastName: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone: string;
  email: string;
  country: string;
  address: string;
  notes: string;
  cinDocUrl: string;
  cinDocName: string;
  cinDocVersoUrl: string;
  cinDocVersoName: string;
  licenseDocUrl: string;
  licenseDocName: string;
  licenseDocVersoUrl: string;
  licenseDocVersoName: string;
}

export interface NewSecondDriverFormData {
  firstName: string;
  lastName: string;
  birthDate: string;
  drivingLicense: string;
  docType: DocumentType;
  docNumber: string;
  phone: string;
  email: string;
}

interface WizardStep1ClientProps {
  clientMode: 'existing' | 'new';
  setClientMode: (mode: 'existing' | 'new') => void;
  clientSearchQuery: string;
  setClientSearchQuery: (q: string) => void;
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  filteredClients: Client[];
  newClientForm: NewClientFormData;
  setNewClientForm: React.Dispatch<React.SetStateAction<NewClientFormData>>;
  // Second driver
  hasSecondDriver: boolean;
  setHasSecondDriver: (has: boolean) => void;
  secondDriverSource: 'driver' | 'client' | 'new';
  setSecondDriverSource: (src: 'driver' | 'client' | 'new') => void;
  selectedSecondDriverId: string;
  setSelectedSecondDriverId: (id: string) => void;
  secondDriverSearchQuery: string;
  setSecondDriverSearchQuery: (q: string) => void;
  filteredDrivers: Driver[];
  clients: Client[];
  isManager: boolean;
  getClientAssignedManager: (client: Client) => { managerId?: string };
  currentUserId?: string;
  newSecondDriverForm: NewSecondDriverFormData;
  setNewSecondDriverForm: React.Dispatch<React.SetStateAction<NewSecondDriverFormData>>;
}

export const WizardStep1Client: React.FC<WizardStep1ClientProps> = ({
  clientMode,
  setClientMode,
  clientSearchQuery,
  setClientSearchQuery,
  selectedClientId,
  setSelectedClientId,
  filteredClients,
  newClientForm,
  setNewClientForm,
  hasSecondDriver,
  setHasSecondDriver,
  secondDriverSource,
  setSecondDriverSource,
  selectedSecondDriverId,
  setSelectedSecondDriverId,
  secondDriverSearchQuery,
  setSecondDriverSearchQuery,
  filteredDrivers,
  clients,
  isManager,
  getClientAssignedManager,
  currentUserId,
  newSecondDriverForm,
  setNewSecondDriverForm,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            Étape 1 : Sélection ou Création du Locataire (Conducteur)
          </h2>
          <p className="text-xs text-slate-400">
            Le locataire sera le signataire principal et responsable contractuel du véhicule.
          </p>
        </div>

        {/* Mode Toggle: Existant vs Nouveau */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setClientMode('existing')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              clientMode === 'existing'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Client Existant
          </button>
          <button
            type="button"
            onClick={() => setClientMode('new')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              clientMode === 'new'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            + Nouveau Client
          </button>
        </div>
      </div>

      {/* OPTION A: CLIENT EXISTANT */}
      {clientMode === 'existing' ? (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, téléphone, C.I.N / Passeport, ou permis..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Client cards selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
            {filteredClients.map((client) => {
              const isSelected = selectedClientId === client.id;
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase">
                        {client.lastName} {client.firstName}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {client.docType} : <span className="text-slate-200 font-mono">{client.docNumber}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Permis : <span className="text-slate-200 font-mono">{client.drivingLicense}</span>
                      </p>
                      <p className="text-[11px] text-amber-400 font-mono mt-1">
                        Tél : {client.phone || 'Non renseigné'}
                      </p>
                      {(client.licenseDocUrl || client.cinDocUrl) && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono mt-1 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          ✓ Documents numérisés
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                        ✓ Sélectionné
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* OPTION B: NOUVEAU CLIENT */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Prénom *</label>
            <input
              type="text"
              value={newClientForm.firstName}
              onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
              placeholder="Ex: Mehdi"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Nom de famille *</label>
            <input
              type="text"
              value={newClientForm.lastName}
              onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
              placeholder="Ex: Alami"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Date de naissance</label>
            <input
              type="date"
              value={newClientForm.birthDate}
              onChange={(e) => setNewClientForm({ ...newClientForm, birthDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Type de document *</label>
            <select
              value={newClientForm.docType}
              onChange={(e) => setNewClientForm({ ...newClientForm, docType: e.target.value as DocumentType })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="CIN">C.I.N (Carte d'Identité Nationale)</option>
              <option value="Passeport">Passeport International</option>
              <option value="Carte de Séjour">Carte de Séjour</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">N° de document (CIN / Passeport) *</label>
            <input
              type="text"
              value={newClientForm.docNumber}
              onChange={(e) => setNewClientForm({ ...newClientForm, docNumber: e.target.value })}
              placeholder="Ex: BJ981240"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">N° Permis de conduire *</label>
            <input
              type="text"
              value={newClientForm.drivingLicense}
              onChange={(e) => setNewClientForm({ ...newClientForm, drivingLicense: e.target.value })}
              placeholder="Ex: B-492019/14"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">
              Téléphone / GSM <span className="text-slate-500 font-normal">(Facultatif)</span>
            </label>
            <input
              type="tel"
              value={newClientForm.phone}
              onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
              placeholder="Ex: +212 661-000000 (Optionnel)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Email (Facultatif)</label>
            <input
              type="email"
              value={newClientForm.email}
              onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
              placeholder="client@gmail.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Pays / Ville de résidence</label>
            <input
              type="text"
              value={newClientForm.country}
              onChange={(e) => setNewClientForm({ ...newClientForm, country: e.target.value })}
              placeholder="Maroc • Casablanca"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-slate-400 mb-1 font-medium">Adresse complète</label>
            <input
              type="text"
              value={newClientForm.address}
              onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
              placeholder="Ex: Boulevard d'Anfa, Résidence Les Fleurs, Casablanca"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* TÉLÉVERSEMENT DES DOCUMENTS (PERMIS & CIN/PASSEPORT) - FACULTATIF */}
          <div className="sm:col-span-3 pt-2">
            <ClientDocumentUpload
              cinRecto={newClientForm.cinDocUrl ? { dataUrl: newClientForm.cinDocUrl, name: newClientForm.cinDocName } : undefined}
              cinVerso={newClientForm.cinDocVersoUrl ? { dataUrl: newClientForm.cinDocVersoUrl, name: newClientForm.cinDocVersoName } : undefined}
              licenseRecto={newClientForm.licenseDocUrl ? { dataUrl: newClientForm.licenseDocUrl, name: newClientForm.licenseDocName } : undefined}
              licenseVerso={newClientForm.licenseDocVersoUrl ? { dataUrl: newClientForm.licenseDocVersoName, name: newClientForm.licenseDocVersoName } : undefined}
              onChange={(docs) => setNewClientForm((prev) => ({ ...prev, ...docs }))}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-SECTION : CONDUCTEUR SECONDAIRE (OPTIONNEL)                          */}
      {/* ========================================================================= */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Conducteur Secondaire Agréé
                  <span className="text-[10px] text-amber-400 font-arabic font-normal">السائق الثاني الإضافي</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ajoutez un deuxième conducteur autorisé à conduire le véhicule sous ce contrat.
                </p>
              </div>
            </div>

            {/* Toggle Button */}
            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-600 transition-all select-none">
              <input
                type="checkbox"
                checked={hasSecondDriver}
                onChange={(e) => setHasSecondDriver(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 relative"></div>
              <span className="text-xs font-semibold text-slate-200">
                {hasSecondDriver ? 'Activé (2 Conducteurs)' : 'Aucun (1 seul)'}
              </span>
            </label>
          </div>

          {/* Second Driver Form (Conditional) */}
          {hasSecondDriver && (
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 space-y-3 animate-in fade-in zoom-in-98 duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <span className="text-[11px] font-semibold text-amber-300">
                  Informations du 2ème Conducteur :
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSecondDriverSource('driver')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      secondDriverSource === 'driver'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Carnet Conducteurs ({filteredDrivers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecondDriverSource('client')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      secondDriverSource === 'client'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Depuis Clients ({clients.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSecondDriverSource('new')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      secondDriverSource === 'new'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    + Nouveau
                  </button>
                </div>
              </div>

              {/* Source: Drivers Repertoire */}
              {secondDriverSource === 'driver' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={secondDriverSearchQuery}
                      onChange={(e) => setSecondDriverSearchQuery(e.target.value)}
                      placeholder="Rechercher conducteur existant par nom, CIN, téléphone..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredDrivers.map((drv) => {
                      const isSelected = selectedSecondDriverId === drv.id;
                      return (
                        <div
                          key={drv.id}
                          onClick={() => setSelectedSecondDriverId(drv.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-white'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-bold uppercase text-white">
                              {drv.lastName} {drv.firstName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {drv.docType} : {drv.docNumber} • Permis : {drv.drivingLicense}
                            </div>
                            <div className="text-[10px] text-amber-400 mt-0.5">
                              📞 {drv.phone}
                            </div>
                          </div>
                          {isSelected && <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                      );
                    })}
                    {filteredDrivers.length === 0 && (
                      <p className="col-span-2 text-center text-slate-500 text-[11px] py-3">
                        Aucun conducteur trouvé. Choisissez "+ Nouveau" pour en saisir un.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Source: Clients Repertoire */}
              {secondDriverSource === 'client' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={secondDriverSearchQuery}
                      onChange={(e) => setSecondDriverSearchQuery(e.target.value)}
                      placeholder="Rechercher client existant..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {clients
                      .filter((c) => {
                        if (clientMode === 'existing' && c.id === selectedClientId) return false;
                        if (isManager) {
                          const mgrInfo = getClientAssignedManager(c);
                          if (mgrInfo.managerId && mgrInfo.managerId !== currentUserId) {
                            return false;
                          }
                        }
                        const q = secondDriverSearchQuery.toLowerCase();
                        return (
                          c.firstName.toLowerCase().includes(q) ||
                          c.lastName.toLowerCase().includes(q) ||
                          c.docNumber.toLowerCase().includes(q)
                        );
                      })
                      .map((cl) => {
                        const isSelected = selectedSecondDriverId === cl.id;
                        return (
                          <div
                            key={cl.id}
                            onClick={() => setSelectedSecondDriverId(cl.id)}
                            className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500 text-white'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-bold uppercase text-white">
                                {cl.lastName} {cl.firstName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {cl.docType} : {cl.docNumber} • Permis : {cl.drivingLicense}
                              </div>
                              <div className="text-[10px] text-amber-400 mt-0.5">
                                📞 {cl.phone}
                              </div>
                            </div>
                            {isSelected && <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Source: New Second Driver Form */}
              {secondDriverSource === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Prénom *</label>
                    <input
                      type="text"
                      value={newSecondDriverForm.firstName}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, firstName: e.target.value })
                      }
                      placeholder="Ex: Karim"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Nom de famille *</label>
                    <input
                      type="text"
                      value={newSecondDriverForm.lastName}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, lastName: e.target.value })
                      }
                      placeholder="Ex: Bennani"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Date de naissance</label>
                    <input
                      type="date"
                      value={newSecondDriverForm.birthDate}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, birthDate: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Type de document *</label>
                    <select
                      value={newSecondDriverForm.docType}
                      onChange={(e) =>
                        setNewSecondDriverForm({
                          ...newSecondDriverForm,
                          docType: e.target.value as DocumentType,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    >
                      <option value="CIN">C.I.N</option>
                      <option value="Passeport">Passeport</option>
                      <option value="Carte de Séjour">Carte de Séjour</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">N° Document (CIN / Passeport) *</label>
                    <input
                      type="text"
                      value={newSecondDriverForm.docNumber}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, docNumber: e.target.value })
                      }
                      placeholder="Ex: BK771234"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white uppercase font-mono focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">N° Permis de conduire *</label>
                    <input
                      type="text"
                      value={newSecondDriverForm.drivingLicense}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, drivingLicense: e.target.value })
                      }
                      placeholder="Ex: B-998811/18"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">
                      Téléphone / GSM <span className="text-slate-500 font-normal">(Facultatif)</span>
                    </label>
                    <input
                      type="tel"
                      value={newSecondDriverForm.phone}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, phone: e.target.value })
                      }
                      placeholder="Ex: +212 662-112233 (Optionnel)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Email (Facultatif)</label>
                    <input
                      type="email"
                      value={newSecondDriverForm.email}
                      onChange={(e) =>
                        setNewSecondDriverForm({ ...newSecondDriverForm, email: e.target.value })
                      }
                      placeholder="conducteur2@gmail.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
