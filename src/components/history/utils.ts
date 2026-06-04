// Funciones auxiliares
export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp === 0) return 'Fecha desconocida';
  
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `hoy ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return 'ayer';
  } else if (diffDays < 7) {
    return `hace ${diffDays} días`;
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

export function formatCommitMessage(message: string, maxLength: number = 80): string {
  const firstLine = message.split('\n')[0] ?? message;
  if (firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength) + '...';
  }
  return firstLine;
}