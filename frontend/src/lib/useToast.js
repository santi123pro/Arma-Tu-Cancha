import { createContext, useContext } from 'react'

// El proveedor está en componentes/Toast.jsx.
export const ToastContext = createContext(null)

export const useToast = () => useContext(ToastContext)
