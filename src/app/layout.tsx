import './globals.css';
import { Inter } from 'next/font/google';
import React from 'react';
import { NextAuthProvider } from './providers';
import { Box } from '@mui/material';
import { Metadata } from 'next';
import { ThemeProvider } from '@/theme/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'Sofos',
	description: 'GPT/Claude Client',
};

interface RootLayoutProps {
	children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
	return (
		<html lang="en">
			<head>
				<link rel="manifest" href="/manifest.json" />
				<link rel="apple-touch-icon" href="/sigma.png" />
				<meta name="theme-color" content="#000000" />
			</head>
		<body className={inter.className}>
		<NextAuthProvider>
			<ThemeProvider>
				<Box className="layoutContainer" sx={{ overflow: 'hidden', maxHeight: '97vh' }}>
					{children}
				</Box>
			</ThemeProvider>
		</NextAuthProvider>
		</body>
		</html>
	);
}
