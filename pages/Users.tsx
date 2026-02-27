import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Edit2, Plus } from 'lucide-react';

interface PermissionItem {
  code: string;
  name?: string;
  description?: string;
}

interface DashboardUser {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

const Users: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DashboardUser | null>(null);
  const [editingUser, setEditingUser] = useState<DashboardUser | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fullName = (u: DashboardUser) => {
    const joined = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return joined || '-';
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<{ results?: DashboardUser[] } | DashboardUser[]>(ENDPOINTS.DASHBOARD.USERS);
      const list = Array.isArray(data) ? data : (data.results || []);
      setUsers(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load users', 'Foydalanuvchilarni yuklab boâ€˜lmadi', 'Foydalanuvchilarni yuklab boâ€˜lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      setLoadingPerms(true);
      const data = await apiRequest<{ results?: PermissionItem[] | string[] }>(ENDPOINTS.AUTH.PERMISSIONS);
      const rows = (data.results || []).map((row) => {
        if (typeof row === 'string') return { code: row } as PermissionItem;
        return row;
      });
      setPermissions(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load permissions', 'Ruxsatlarni yuklab boâ€˜lmadi', 'Ruxsatlarni yuklab boâ€˜lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoadingPerms(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePermission = (code: string) => {
    setSelectedPerms((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  };

  const openDetail = async (userRow: DashboardUser) => {
    setSelectedUser(userRow);
    setIsDetailOpen(true);
    try {
      setDetailLoading(true);
      const detail = await apiRequest<{ user?: DashboardUser } | DashboardUser>(ENDPOINTS.DASHBOARD.USER_DETAIL(userRow.id));
      const row = (detail as { user?: DashboardUser }).user || (detail as DashboardUser);
      setSelectedUser((prev) => ({ ...(prev || userRow), ...row }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 405) {
        return;
      }
      const message = e instanceof Error ? e.message : tr('Failed to load user detail', 'Foydalanuvchi tafsilotlarini yuklab boâ€˜lmadi', 'Foydalanuvchi tafsilotlarini yuklab boâ€˜lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const onCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      setSaving(true);
      setError(null);
      await apiRequest(ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        body: JSON.stringify({
          username: String(form.get('username') || ''),
          password: String(form.get('password') || ''),
          first_name: String(form.get('first_name') || ''),
          last_name: String(form.get('last_name') || ''),
          email: String(form.get('email') || ''),
          role: 'SUPERUSER',
          permission_codes: selectedPerms,
        }),
      });
      toast.success(tr('User created successfully.', 'Foydalanuvchi yaratildi.', 'Foydalanuvchi yaratildi.'));
      setIsCreateOpen(false);
      e.currentTarget.reset();
      setSelectedPerms([]);
      await loadUsers();
    } catch (e2) {
      const message = e2 instanceof Error ? e2.message : tr('Failed to create user', 'Foydalanuvchini yaratib boâ€˜lmadi', 'Foydalanuvchini yaratib boâ€˜lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: DashboardUser) => {
    setEditingUser(u);
    setEditPerms(u.permissions || []);
    setIsEditOpen(true);
  };

  const toggleEditPermission = (code: string) => {
    setEditPerms((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  };

  const onUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') || '').trim();
    const payload: Record<string, unknown> = {
      username: String(form.get('username') || ''),
      first_name: String(form.get('first_name') || ''),
      last_name: String(form.get('last_name') || ''),
      email: String(form.get('email') || ''),
      role: String(form.get('role') || editingUser.role || 'SUPERUSER'),
      is_active: form.get('is_active') === 'on',
      permission_codes: editPerms,
    };
    if (password) {
      payload.password = password;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest(ENDPOINTS.DASHBOARD.USER_DETAIL(editingUser.id), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success(tr('User updated successfully.', 'Foydalanuvchi yangilandi.', 'Foydalanuvchi yangilandi.'));
      setIsEditOpen(false);
      setEditingUser(null);
      await loadUsers();
      if (selectedUser?.id === editingUser.id) {
        setSelectedUser((prev) => prev ? { ...prev, ...payload, permissions: editPerms } as DashboardUser : prev);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 405) {
        const message = tr('Edit method is not enabled on backend yet (405).', 'Backendda tahrirlash metodi hali yoqilmagan (405).', 'Backendda tahrirlash metodi hali yoqilmagan (405).');
        setError(message);
        toast.error(message);
        return;
      }
      const message = e instanceof Error ? e.message : tr('Failed to update user', 'Foydalanuvchini yangilab boâ€˜lmadi', 'Foydalanuvchini yangilab boâ€˜lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const selectedPermissions = useMemo(() => selectedUser?.permissions || [], [selectedUser]);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('User Management', 'Foydalanuvchilar boshqaruvi', 'Foydalanuvchilar boshqaruvi')}</h1>
        <Card>
          <p className="text-sm text-red-600">{tr('Only ADMIN can access this page.', 'Bu sahifaga faqat ADMIN kira oladi.', 'Bu sahifaga faqat ADMIN kira oladi.')}</p>
          <p className="text-xs text-gray-500 mt-1">{tr('Current role', 'Joriy rol', 'Joriy rol')}: {user?.role || '-'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('User Management', 'Foydalanuvchilar boshqaruvi', 'Foydalanuvchilar boshqaruvi')}</h1>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {tr('Add User', "Foydalanuvchi qo'shish", "Foydalanuvchi qo'shish")} <Plus size={16} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Username', 'Login', 'Login')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Full Name', 'Toâ€˜liq ism', 'Toâ€˜liq ism')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Email', 'Email', 'Email')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Role', 'Rol', 'Rol')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Status', 'Holat', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Amallar', 'Amallar')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{tr('Loading users...', 'Foydalanuvchilar yuklanmoqda...', 'Foydalanuvchilar yuklanmoqda...')}</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{tr('No users found.', 'Foydalanuvchilar topilmadi.', 'Foydalanuvchilar topilmadi.')}</td></tr>
              )}
              {!loading && users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openDetail(u)}
                  className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium text-primary-blue dark:text-blue-400">{u.username || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{fullName(u)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{u.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{u.role || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.is_active === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {u.is_active === false ? tr('Inactive', 'Nofaol', 'Nofaol') : tr('Active', 'Faol', 'Faol')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(u);
                        }}
                        className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"
                        title={tr('Edit user', 'Foydalanuvchini tahrirlash', 'Foydalanuvchini tahrirlash')}
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={tr('Add User', "Foydalanuvchi qo'shish", "Foydalanuvchi qo'shish")}
        footer={null}
      >
        <form onSubmit={onCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username', 'Login', 'Login')}</label>
              <input name="username" required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Password', 'Parol', 'Parol')}</label>
              <input name="password" type="password" required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('First Name', 'Ism', 'Ism')}</label>
              <input name="first_name" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Last Name', 'Familiya', 'Familiya')}</label>
              <input name="last_name" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Email', 'Email', 'Email')}</label>
              <input name="email" type="email" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('Permissions', 'Ruxsatlar', 'Ruxsatlar')}</p>
            {loadingPerms ? (
              <p className="text-sm text-gray-500">{tr('Loading permissions...', 'Ruxsatlar yuklanmoqda...', 'Ruxsatlar yuklanmoqda...')}</p>
            ) : (
              <div className="max-h-56 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                {permissions.map((perm) => (
                  <label key={perm.code} className="flex items-start gap-2 p-2 rounded border border-light-border dark:border-navy-700">
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(perm.code)}
                      onChange={() => togglePermission(perm.code)}
                    />
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{perm.code}</p>
                      {perm.description && <p className="text-xs text-gray-500">{perm.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">
                {tr('Cancel', 'Bekor qilish', 'Bekor qilish')}
              </button>
              <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">
                {saving ? tr('Creating...', 'Yaratilmoqda...', 'Yaratilmoqda...') : tr('Create User', "Foydalanuvchi yaratish", "Foydalanuvchi yaratish")}
              </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditingUser(null); }}
        title={editingUser ? `${tr('Edit User', 'Foydalanuvchini tahrirlash', 'Foydalanuvchini tahrirlash')}: ${editingUser.username}` : tr('Edit User', 'Foydalanuvchini tahrirlash', 'Foydalanuvchini tahrirlash')}
        footer={null}
      >
        {editingUser && (
          <form onSubmit={onUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username', 'Login', 'Login')}</label>
                <input name="username" required defaultValue={editingUser.username} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('New Password (optional)', 'Yangi parol (ixtiyoriy)', 'Yangi parol (ixtiyoriy)')}</label>
                <input name="password" type="password" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('First Name', 'Ism', 'Ism')}</label>
                <input name="first_name" defaultValue={editingUser.first_name || ''} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Last Name', 'Familiya', 'Familiya')}</label>
                <input name="last_name" defaultValue={editingUser.last_name || ''} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Email', 'Email', 'Email')}</label>
                <input name="email" type="email" defaultValue={editingUser.email || ''} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Role', 'Rol', 'Rol')}</label>
                <select name="role" defaultValue={editingUser.role || 'SUPERUSER'} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
                  <option value="SUPERUSER">SUPERUSER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input name="is_active" type="checkbox" defaultChecked={editingUser.is_active !== false} />
                  {tr('Active', 'Faol', 'Faol')}
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('Permissions', 'Ruxsatlar', 'Ruxsatlar')}</p>
              {loadingPerms ? (
                <p className="text-sm text-gray-500">{tr('Loading permissions...', 'Ruxsatlar yuklanmoqda...', 'Ruxsatlar yuklanmoqda...')}</p>
              ) : (
                <div className="max-h-56 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                  {permissions.map((perm) => (
                    <label key={perm.code} className="flex items-start gap-2 p-2 rounded border border-light-border dark:border-navy-700">
                      <input
                        type="checkbox"
                        checked={editPerms.includes(perm.code)}
                        onChange={() => toggleEditPermission(perm.code)}
                      />
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{perm.code}</p>
                        {perm.description && <p className="text-xs text-gray-500">{perm.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setIsEditOpen(false); setEditingUser(null); }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">
                {tr('Cancel', 'Bekor qilish', 'Bekor qilish')}
              </button>
              <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">
                {saving ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : tr('Save Changes', 'Oâ€˜zgarishlarni saqlash', 'Oâ€˜zgarishlarni saqlash')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedUser(null); }}
        title={selectedUser ? `${tr('User', 'Foydalanuvchi', 'Foydalanuvchi')}: ${selectedUser.username}` : tr('User Details', 'Foydalanuvchi tafsilotlari', 'Foydalanuvchi tafsilotlari')}
        footer={selectedUser ? (
          <div className="flex justify-end w-full">
            <button
              onClick={() => {
                setIsDetailOpen(false);
                openEdit(selectedUser);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
            >
              {tr('Edit', 'Tahrirlash', 'Tahrirlash')} <Edit2 size={14} />
            </button>
          </div>
        ) : null}
      >
        {detailLoading && <p className="text-sm text-gray-500">{tr('Loading user details...', 'Foydalanuvchi tafsilotlari yuklanmoqda...', 'Foydalanuvchi tafsilotlari yuklanmoqda...')}</p>}
        {!detailLoading && selectedUser && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><p className="text-gray-500">{tr('Username', 'Login', 'Login')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.username || '-'}</p></div>
              <div><p className="text-gray-500">{tr('Role', 'Rol', 'Rol')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.role || '-'}</p></div>
              <div><p className="text-gray-500">{tr('First Name', 'Ism', 'Ism')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.first_name || '-'}</p></div>
              <div><p className="text-gray-500">{tr('Last Name', 'Familiya', 'Familiya')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.last_name || '-'}</p></div>
              <div className="md:col-span-2"><p className="text-gray-500">{tr('Email', 'Email', 'Email')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.email || '-'}</p></div>
              <div><p className="text-gray-500">{tr('Status', 'Holat', 'Holat')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.is_active === false ? tr('Inactive', 'Nofaol', 'Nofaol') : tr('Active', 'Faol', 'Faol')}</p></div>
              <div><p className="text-gray-500">{tr('Created', 'Yaratilgan', 'Yaratilgan')}</p><p className="font-medium text-gray-900 dark:text-white">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : '-'}</p></div>
            </div>

            <div>
              <p className="text-gray-500 mb-2">{tr('Permissions', 'Ruxsatlar', 'Ruxsatlar')}</p>
              {selectedPermissions.length === 0 ? (
                <p className="text-gray-500">{tr('No permissions', 'Ruxsatlar yoâ€˜q', 'Ruxsatlar yoâ€˜q')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedPermissions.map((code) => (
                    <span key={code} className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs border border-blue-100">
                      {code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Users;

