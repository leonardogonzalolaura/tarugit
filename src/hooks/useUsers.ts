import { useState } from 'react';
import { toast } from '../components/Toast';

const STORAGE_KEY = 'tarugit_users';
const DEFAULT_AUTHOR_KEY = 'tarugit_default_author';

export interface CommitUser {
  name: string;
  email: string;
}

function loadUsers(): CommitUser[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { }
  return [{ name: "tauriGitUser", email: "tauriuser@gmail.com" }];
}

function loadDefaultAuthor(): number {
  try {
    const idx = localStorage.getItem(DEFAULT_AUTHOR_KEY);
    if (idx !== null) return Math.max(0, parseInt(idx, 10) || 0);
  } catch { }
  return 0;
}

export function useUsers() {
  const [users, setUsers] = useState<CommitUser[]>(loadUsers);
  const [defaultAuthorIndex, setDefaultAuthorIndexState] = useState<number>(loadDefaultAuthor);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const setDefaultAuthorIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, users.length - 1));
    setDefaultAuthorIndexState(clamped);
    localStorage.setItem(DEFAULT_AUTHOR_KEY, String(clamped));
  };

  const handleAddUser = () => {
    setNewUserName('');
    setNewUserEmail('');
    setShowUserModal(true);
  };

  const saveNewUser = () => {
    if (!newUserName.trim()) {
      toast.warning('El nombre es obligatorio');
      return;
    }
    if (!newUserEmail.trim()) {
      toast.warning('El correo es obligatorio');
      return;
    }
    if (!newUserEmail.includes('@') || !newUserEmail.includes('.')) {
      toast.warning('Ingresa un correo válido (ej: usuario@empresa.com)');
      return;
    }

    const updated = [...users, { name: newUserName.trim(), email: newUserEmail.trim() }];
    setUsers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowUserModal(false);
    toast.success('Usuario agregado correctamente');
  };

  const deleteUser = (idx: number) => {
    const updated = users.filter((_, i) => i !== idx);
    setUsers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (defaultAuthorIndex >= updated.length) {
      setDefaultAuthorIndex(Math.max(0, updated.length - 1));
    }
    toast.success('Usuario eliminado');
  };

  return {
    users, showUserModal, newUserName, newUserEmail, defaultAuthorIndex,
    setShowUserModal, setNewUserName, setNewUserEmail,
    handleAddUser, saveNewUser, setDefaultAuthorIndex, deleteUser,
  };
}
