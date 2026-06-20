import { useState } from 'react';
import { toast } from '../components/Toast';

const STORAGE_KEY = 'tarugit_users';

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

export function useUsers() {
  const [users, setUsers] = useState<CommitUser[]>(loadUsers);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

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

  return {
    users, showUserModal, newUserName, newUserEmail,
    setShowUserModal, setNewUserName, setNewUserEmail,
    handleAddUser, saveNewUser,
  };
}
