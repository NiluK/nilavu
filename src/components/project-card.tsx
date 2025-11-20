"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Folder } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/dashboard/${project.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ 
          scale: 1.02,
          transition: { duration: 0.2 }
        }}
        whileTap={{ scale: 0.98 }}
        className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
      >
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        <h3 className="relative text-lg font-semibold">
          {project.name}
        </h3>
        <p className="relative mt-2 text-sm text-muted-foreground line-clamp-2">
          {project.description || 'No description provided'}
        </p>
        <div className="relative mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </motion.div>
    </Link>
  );
}
