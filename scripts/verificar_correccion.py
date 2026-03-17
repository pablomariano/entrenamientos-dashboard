"""
Script para verificar que el cambio de offset corrige el problema de HR.
"""

import sys
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession
from polar_rcx5_datalink.exceptions import SyncError


def verificar_sesion(sess):
    """Verifica que los valores de HR ahora sean correctos."""
    print(f"\n{'='*80}")
    print(f"Verificando sesión: {sess.id}")
    print(f"{'='*80}")
    
    print(f"\nEstadísticas del header:")
    print(f"  HR Promedio: {sess.info.get('hr_avg')} bpm")
    print(f"  HR Máximo: {sess.info.get('hr_max')} bpm")
    print(f"  HR Mínimo: {sess.info.get('hr_min')} bpm")
    
    if not sess.has_hr:
        print("\n⚠️ Esta sesión no tiene HR.")
        return True
    
    try:
        # Parsear muestras
        sess.parse_samples()
        
        if len(sess.samples) == 0:
            print("\n⚠️ No se parsearon muestras.")
            return False
        
        # Extraer valores de HR
        hrs = [s.hr for s in sess.samples if s.hr is not None]
        
        if len(hrs) == 0:
            print("\n⚠️ No hay valores de HR en las muestras.")
            return False
        
        print(f"\nMuestras parseadas: {len(sess.samples)}")
        print(f"Valores de HR: {len(hrs)}")
        
        # Estadísticas de las muestras
        min_hr = min(hrs)
        max_hr = max(hrs)
        avg_hr = sum(hrs) / len(hrs)
        
        print(f"\nEstadísticas de las muestras:")
        print(f"  HR Mínimo: {min_hr} bpm")
        print(f"  HR Máximo: {max_hr} bpm")
        print(f"  HR Promedio: {avg_hr:.1f} bpm")
        
        # Verificar rango válido
        fuera_rango = [h for h in hrs if h > 250 or h < 30]
        
        if len(fuera_rango) > 0:
            print(f"\n⚠️ ADVERTENCIA: {len(fuera_rango)}/{len(hrs)} valores fuera de rango (30-250 bpm)")
            print(f"  Ejemplos: {fuera_rango[:10]}")
            return False
        else:
            print(f"\n✅ CORRECTO: Todos los valores están en rango válido (30-250 bpm)")
        
        # Comparar con header
        hr_avg_header = sess.info.get('hr_avg')
        diferencia = abs(avg_hr - hr_avg_header)
        
        print(f"\nComparación con header:")
        print(f"  Header: {hr_avg_header} bpm")
        print(f"  Muestras: {avg_hr:.1f} bpm")
        print(f"  Diferencia: {diferencia:.1f} bpm")
        
        if diferencia > 20:
            print(f"  ⚠️ Diferencia grande (>{20} bpm)")
            return False
        else:
            print(f"  ✅ Diferencia aceptable (<{20} bpm)")
        
        # Mostrar primeras 10 muestras
        print(f"\nPrimeras 10 muestras de HR:")
        for i, hr in enumerate(hrs[:10]):
            print(f"  Muestra {i+1}: {hr} bpm")
        
        return True
        
    except Exception as e:
        print(f"\n✗ ERROR al parsear: {type(e).__name__}: {e}")
        return False


def main():
    print("="*80)
    print("VERIFICACIÓN DE CORRECCIÓN DEL OFFSET DE HR")
    print("="*80)
    print("\nEste script verifica que el cambio de offset 22→16 funciona correctamente.\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/2] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Buscar sesiones con HR
        print(f"\n[2/2] Verificando sesiones con HR...")
        sesiones_con_hr = []
        
        for i, raw_session in enumerate(raw_sessions):
            try:
                sess = TrainingSession(raw_session)
                if sess.has_hr:
                    sesiones_con_hr.append((i, sess))
            except:
                pass
        
        print(f"✓ Encontradas {len(sesiones_con_hr)} sesiones con HR")
        
        if len(sesiones_con_hr) == 0:
            print("\n⚠️ No hay sesiones con HR para verificar.")
            return
        
        # Verificar las últimas 3 sesiones
        num_verificar = min(3, len(sesiones_con_hr))
        print(f"\nVerificando las últimas {num_verificar} sesiones...")
        
        resultados = []
        for idx, sess in sesiones_con_hr[-num_verificar:]:
            resultado = verificar_sesion(sess)
            resultados.append((sess.id, resultado))
        
        # Resumen
        print(f"\n{'='*80}")
        print("RESUMEN")
        print(f"{'='*80}")
        
        exitosas = sum(1 for _, r in resultados if r)
        print(f"\nSesiones verificadas: {len(resultados)}")
        print(f"✅ Correctas: {exitosas}")
        print(f"❌ Con problemas: {len(resultados) - exitosas}")
        
        if exitosas == len(resultados):
            print(f"\n{'='*80}")
            print("🎉 ¡ÉXITO! El cambio de offset funciona correctamente.")
            print("="*80)
            print("\nAhora puedes:")
            print("1. Exportar tus datos: python exportar_para_dashboard.py")
            print("2. Ver el dashboard: python abrir_dashboard.py")
            print("\nLos valores de HR deberían estar en el rango correcto (30-250 bpm).")
        else:
            print(f"\n⚠️ Algunas sesiones aún tienen problemas.")
            print("Puede ser normal si:")
            print("- Son sesiones muy antiguas con diferente formato")
            print("- Tienen datos corruptos en el reloj")
            print("- Usan una configuración diferente")
        
    except SyncError as e:
        print(f"\n✗ Error de sincronización: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
