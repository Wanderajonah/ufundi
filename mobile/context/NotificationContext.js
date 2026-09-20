import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getErrorMessage,
} from '../services/usersApi';
import {
  connectSocket,
  subscribeSocket,
} from '../services/socketService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, userId, authToken }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!authToken || !userId) return;
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        getMyNotifications(),
        getUnreadNotificationCount(),
      ]);
      setNotifications(listRes?.data?.notifications || []);
      setUnreadCount(Number(countRes?.data?.unreadCount) || 0);
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [authToken, userId]);

  useEffect(() => {
    if (!authToken || !userId) return undefined;
    connectSocket(userId, authToken);
    refresh();
    const unsub = subscribeSocket('user_notification', (payload) => {
      if (!payload?.id) return;
      setNotifications((prev) =>
        prev.some((n) => n.id === payload.id)
          ? prev
          : [payload, ...prev]
      );
      setUnreadCount((c) => c + 1);
    });
    return () => unsub?.();
  }, [authToken, userId, refresh]);

  const markRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch (e) {
      refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const hadUnread = unreadCount > 0;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    if (!hadUnread) return;
    try {
      await markAllNotificationsRead();
    } catch (e) {
      refresh();
    }
  }, [unreadCount, refresh]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      refresh,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, loading, error, refresh, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

export function useNotificationsOptional() {
  return useContext(NotificationContext);
}