import { appNavigation } from "@/config/appNavigation";
import type { Module } from "@/hooks/useModules";

export interface PermissionDisplayNode {
  key: string;
  code: string;
  name: string;
  children: PermissionDisplayNode[];
}

export interface PermissionDisplaySection {
  key: string;
  name: string;
  children: PermissionDisplayNode[];
}

const uniqueLabels = (labels: string[]) => Array.from(new Set(labels));

const buildDescendants = (
  parentCode: string,
  childrenByParent: Map<string, Module[]>,
  prefix: string,
): PermissionDisplayNode[] => {
  const children = childrenByParent.get(parentCode) ?? [];

  return children.map((child, index) => ({
    key: `${prefix}:${child.code}:${index}`,
    code: child.code,
    name: child.name,
    children: buildDescendants(child.code, childrenByParent, `${prefix}:${child.code}:${index}`),
  }));
};

export const buildPermissionSections = (modules: Module[]): PermissionDisplaySection[] => {
  const childrenByParent = new Map<string, Module[]>();

  modules.forEach((module) => {
    if (!module.parent_code) return;
    const siblings = childrenByParent.get(module.parent_code) ?? [];
    siblings.push(module);
    siblings.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "sr"));
    childrenByParent.set(module.parent_code, siblings);
  });

  return appNavigation.flatMap((item, sectionIndex) => {
    if (item.label === "Kontrolna tabla" || item.label === "AI Asistent") {
      return [];
    }

    const sectionKey = `section:${sectionIndex}:${item.label}`;

    if (item.children?.length) {
      const groupedChildren = new Map<string, string[]>();

      item.children.forEach((child) => {
        if (!child.moduleCode) return;
        const labels = groupedChildren.get(child.moduleCode) ?? [];
        labels.push(child.label);
        groupedChildren.set(child.moduleCode, labels);
      });

      const children = Array.from(groupedChildren.entries()).map(([moduleCode, labels], childIndex) => ({
        key: `${sectionKey}:child:${childIndex}:${moduleCode}`,
        code: moduleCode,
        name: uniqueLabels(labels).join(" / "),
        children: buildDescendants(moduleCode, childrenByParent, `${sectionKey}:child:${childIndex}:${moduleCode}`),
      }));

      return children.length > 0
        ? [{ key: sectionKey, name: item.label, children }]
        : [];
    }

    if (!item.moduleCode) {
      return [];
    }

    const descendants = buildDescendants(item.moduleCode, childrenByParent, `${sectionKey}:root`);

    return [
      {
        key: sectionKey,
        name: item.label,
        children:
          descendants.length > 0
            ? descendants
            : [
                {
                  key: `${sectionKey}:self:${item.moduleCode}`,
                  code: item.moduleCode,
                  name: item.label,
                  children: [],
                },
              ],
      },
    ];
  });
};

export const collectPermissionCodes = (nodes: PermissionDisplayNode[]): string[] => {
  const codes = new Set<string>();

  const visit = (items: PermissionDisplayNode[]) => {
    items.forEach((item) => {
      codes.add(item.code);
      if (item.children.length > 0) {
        visit(item.children);
      }
    });
  };

  visit(nodes);
  return Array.from(codes);
};
