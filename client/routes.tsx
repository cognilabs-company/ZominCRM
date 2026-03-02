import React from 'react';
import { Droplets, Home, Package, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react';

const ClientBottlesPage = React.lazy(() => import('./pages/ClientBottlesPage').then((module) => ({ default: module.ClientBottlesPage })));
const ClientCartPage = React.lazy(() => import('./pages/ClientCartPage').then((module) => ({ default: module.ClientCartPage })));
const ClientCheckoutPreviewPage = React.lazy(() => import('./pages/ClientCheckoutPreviewPage').then((module) => ({ default: module.ClientCheckoutPreviewPage })));
const ClientHomePage = React.lazy(() => import('./pages/ClientHomePage').then((module) => ({ default: module.ClientHomePage })));
const ClientOrderDetailPage = React.lazy(() => import('./pages/ClientOrderDetailPage').then((module) => ({ default: module.ClientOrderDetailPage })));
const ClientOrdersPage = React.lazy(() => import('./pages/ClientOrdersPage').then((module) => ({ default: module.ClientOrdersPage })));
const ClientProductsPage = React.lazy(() => import('./pages/ClientProductsPage').then((module) => ({ default: module.ClientProductsPage })));
const ClientProfilePage = React.lazy(() => import('./pages/ClientProfilePage').then((module) => ({ default: module.ClientProfilePage })));

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
    id: 'checkout',
    path: 'checkout',
    navLabelKey: 'nav.checkout',
    icon: Package,
    showInNav: false,
    element: <ClientCheckoutPreviewPage />,
  },
  {
    id: 'checkout-preview',
    path: 'checkout-preview',
    navLabelKey: 'nav.checkout',
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
    id: 'order-detail',
    path: 'orders/:orderId',
    navLabelKey: 'nav.orders',
    icon: Package,
    showInNav: false,
    element: <ClientOrderDetailPage />,
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
