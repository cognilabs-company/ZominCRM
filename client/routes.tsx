import React from 'react';
import { Droplets, Home, Package, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react';
import { ClientBottlesPage } from './pages/ClientBottlesPage';
import { ClientCartPage } from './pages/ClientCartPage';
import { ClientCheckoutPreviewPage } from './pages/ClientCheckoutPreviewPage';
import { ClientHomePage } from './pages/ClientHomePage';
import { ClientOrdersPage } from './pages/ClientOrdersPage';
import { ClientProductsPage } from './pages/ClientProductsPage';
import { ClientProfilePage } from './pages/ClientProfilePage';

export interface ClientRouteDefinition {
  id: string;
  path: string;
  label: string;
  navLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  showInNav: boolean;
  element: React.ReactElement;
}

export const clientRouteDefinitions: ClientRouteDefinition[] = [
  {
    id: 'home',
    path: 'home',
    label: 'Home',
    navLabel: 'Home',
    icon: Home,
    showInNav: true,
    element: <ClientHomePage />,
  },
  {
    id: 'products',
    path: 'products',
    label: 'Products',
    navLabel: 'Products',
    icon: ShoppingBag,
    showInNav: true,
    element: <ClientProductsPage />,
  },
  {
    id: 'cart',
    path: 'cart',
    label: 'Cart',
    navLabel: 'Cart',
    icon: ShoppingCart,
    showInNav: true,
    element: <ClientCartPage />,
  },
  {
    id: 'checkout-preview',
    path: 'checkout-preview',
    label: 'Checkout Preview',
    navLabel: 'Preview',
    icon: Package,
    showInNav: false,
    element: <ClientCheckoutPreviewPage />,
  },
  {
    id: 'orders',
    path: 'orders',
    label: 'Orders',
    navLabel: 'Orders',
    icon: Package,
    showInNav: true,
    element: <ClientOrdersPage />,
  },
  {
    id: 'bottles',
    path: 'bottles',
    label: 'Bottles',
    navLabel: 'Bottles',
    icon: Droplets,
    showInNav: true,
    element: <ClientBottlesPage />,
  },
  {
    id: 'profile',
    path: 'profile',
    label: 'Profile',
    navLabel: 'Profile',
    icon: UserRound,
    showInNav: false,
    element: <ClientProfilePage />,
  },
];
