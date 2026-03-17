"""
Script simple para abrir el dashboard con un servidor HTTP local.
Esto evita problemas de CORS al abrir archivos HTML directamente.
"""

import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000
DIRECTORY = Path(__file__).parent

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        # Permitir CORS para desarrollo local
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

def main():
    # Verificar que existe el archivo JSON
    json_file = DIRECTORY / 'entrenamientos_dashboard' / 'entrenamientos.json'
    if not json_file.exists():
        print("="*80)
        print("⚠ ADVERTENCIA: No se encontró el archivo JSON")
        print("="*80)
        print(f"\nEl archivo esperado es: {json_file}")
        print("\nPor favor, ejecuta primero:")
        print("  python exportar_para_dashboard.py")
        print("\nLuego vuelve a ejecutar este script.")
        input("\nPresiona ENTER para salir...")
        return
    
    print("="*80)
    print("🚀 Iniciando servidor local para el Dashboard")
    print("="*80)
    print(f"\nServidor corriendo en: http://localhost:{PORT}")
    print(f"Directorio: {DIRECTORY}")
    print(f"\nEl dashboard se abrirá automáticamente en tu navegador.")
    print("Presiona Ctrl+C para detener el servidor.\n")
    
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            # Abrir el navegador automáticamente
            url = f"http://localhost:{PORT}/ejemplo_dashboard.html"
            print(f"Abriendo: {url}\n")
            webbrowser.open(url)
            
            # Servir archivos
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n✅ Servidor detenido. ¡Hasta luego!")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\n❌ Error: El puerto {PORT} ya está en uso.")
            print("Cierra otras aplicaciones que puedan estar usando ese puerto,")
            print("o modifica el valor de PORT en este script.")
        else:
            print(f"\n❌ Error: {e}")

if __name__ == '__main__':
    main()
