import type { ClusterNode } from "../types";

// TODO: Also add descriptions to the nodes datatype

export const dummyClusterData: ClusterNode[] = [
    {
        id: "l2-1",
        name: "Software Development Tutorials",
        type: "l2",
        trace_count: 45,
        children: [
            {
                id: "l1-1-1",
                name: "Full-Stack Web Development",
                type: "l1",
                trace_count: 22,
                children: [
                    {
                        id: "l0-1-1-1",
                        name: "React & Frontend",
                        type: "l0",
                        trace_count: 8,
                    },
                    {
                        id: "l0-1-1-2",
                        name: "Node.js & Backend",
                        type: "l0",
                        trace_count: 7,
                    },
                    {
                        id: "l0-1-1-3",
                        name: "Database Design",
                        type: "l0",
                        trace_count: 7,
                    },
                ],
            },
            {
                id: "l1-1-2",
                name: "Mobile Development",
                type: "l1",
                trace_count: 15,
                children: [
                    {
                        id: "l0-1-2-1",
                        name: "Android Development",
                        type: "l0",
                        trace_count: 8,
                    },
                    {
                        id: "l0-1-2-2",
                        name: "Flutter & Cross-Platform",
                        type: "l0",
                        trace_count: 7,
                    },
                ],
            },
            {
                id: "l1-1-3",
                name: "API Integration",
                type: "l1",
                trace_count: 8,
                children: [
                    {
                        id: "l0-1-3-1",
                        name: "REST APIs",
                        type: "l0",
                        trace_count: 4,
                    },
                    {
                        id: "l0-1-3-2",
                        name: "Authentication",
                        type: "l0",
                        trace_count: 4,
                    },
                ],
            },
        ],
    },
    {
        id: "l2-2",
        name: "Data Science & Analytics",
        type: "l2",
        trace_count: 30,
        children: [
            {
                id: "l1-2-1",
                name: "Machine Learning",
                type: "l1",
                trace_count: 18,
                children: [
                    {
                        id: "l0-2-1-1",
                        name: "Deep Learning",
                        type: "l0",
                        trace_count: 9,
                    },
                    {
                        id: "l0-2-1-2",
                        name: "Classical ML",
                        type: "l0",
                        trace_count: 9,
                    },
                ],
            },
            {
                id: "l1-2-2",
                name: "Data Processing",
                type: "l1",
                trace_count: 12,
                children: [
                    {
                        id: "l0-2-2-1",
                        name: "ETL Pipelines",
                        type: "l0",
                        trace_count: 6,
                    },
                    {
                        id: "l0-2-2-2",
                        name: "Data Visualization",
                        type: "l0",
                        trace_count: 6,
                    },
                ],
            },
        ],
    },
    {
        id: "l2-3",
        name: "DevOps & Infrastructure",
        type: "l2",
        trace_count: 25,
        children: [
            {
                id: "l1-3-1",
                name: "Containerization",
                type: "l1",
                trace_count: 15,
                children: [
                    {
                        id: "l0-3-1-1",
                        name: "Docker",
                        type: "l0",
                        trace_count: 8,
                    },
                    {
                        id: "l0-3-1-2",
                        name: "Kubernetes",
                        type: "l0",
                        trace_count: 7,
                    },
                ],
            },
            {
                id: "l1-3-2",
                name: "CI/CD",
                type: "l1",
                trace_count: 10,
                children: [
                    {
                        id: "l0-3-2-1",
                        name: "GitHub Actions",
                        type: "l0",
                        trace_count: 5,
                    },
                    {
                        id: "l0-3-2-2",
                        name: "Deployment Strategies",
                        type: "l0",
                        trace_count: 5,
                    },
                ],
            },
        ],
    },
];

