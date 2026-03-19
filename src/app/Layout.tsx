import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Timer" },
  { to: "/history", label: "History" },
  { to: "/training", label: "Training" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3">
        <ul className="flex gap-6">
          {navItems.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive
                    ? "text-white font-semibold"
                    : "text-gray-400 hover:text-white"
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
