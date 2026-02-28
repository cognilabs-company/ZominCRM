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
  navLabelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  showInNav: boolean;
  element: React.ReactElement;
}

export const clientRouteDefinitions: ClientRouteDefinition[] = [
  {
    id: 'home',
    path: 'home',
    navLabelKey: 'nav.home',
    icon: Home,
    showInNav: true,
    element: <ClientHomePage />,
  },
  {
    id: 'products',
    path: 'products',
    navLabelKey: 'nav.products',
    icon: ShoppingBag,
    showInNav: true,
    element: <ClientProductsPage />,
  },
  {
    id: 'cart',
    path: 'cart',
    navLabelKey: 'nav.cart',
    icon: ShoppingCart,
    showInNav: true,
    element: <ClientCartPage />,
  },
  {
    id: 'checkout-preview',
    path: 'checkout-preview',
    navLabelKey: 'nav.preview',
    icon: Package,
    showInNav: false,
    element: <ClientCheckoutPreviewPage />,
  },
  {
    id: 'orders',
    path: 'orders',
    navLabelKey: 'nav.orders',
    icon: Package,
    showInNav: true,
    element: <ClientOrdersPage />,
  },
  {
    id: 'bottles',
    path: 'bottles',
    navLabelKey: 'nav.bottles',
    icon: Droplets,
    showInNav: true,
    element: <ClientBottlesPage />,
  },
  {
    id: 'profile',
    path: 'profile',
    navLabelKey: 'nav.profile',
    icon: UserRound,
    showInNav: false,
    element: <ClientProfilePage />,
  },
];
