// src/features/training/TrainingPage.tsx
import { Link } from "react-router-dom";

const TRAINING_TOOLS = [
  {
    title: "Cross Trainer",
    description: "Practice solving the cross with optimal solution comparison",
    path: "/training/cross",
  },
  {
    title: "PLL Trainer",
    description: "Drill and learn all 21 PLL algorithms with smart case selection and move-by-move feedback",
    path: "/training/pll",
  },
];

export function TrainingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Training</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRAINING_TOOLS.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="rounded-lg bg-gray-800 p-6 transition-colors hover:bg-gray-700"
          >
            <h2 className="text-lg font-semibold">{tool.title}</h2>
            <p className="mt-2 text-sm text-gray-400">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
