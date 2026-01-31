"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  bookCount: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((response) => response.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-3xl font-bold">{users.length}</p>
          <p className="text-gray-600 dark:text-gray-400">Total Users</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-3xl font-bold">
            {users.reduce((sum, user) => sum + user.bookCount, 0)}
          </p>
          <p className="text-gray-600 dark:text-gray-400">Total Books</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-3xl font-bold">
            {
              users.filter((user) => {
                const created = new Date(user.createdAt);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return created > weekAgo;
              }).length
            }
          </p>
          <p className="text-gray-600 dark:text-gray-400">New This Week</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium">Email</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Role</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Books</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 text-sm">{user.email}</td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">{user.bookCount}</td>
                <td className="px-6 py-4 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
