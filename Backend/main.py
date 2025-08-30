from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime
import pymysql
import json

app = FastAPI(title="Issue Tracker API")

# Configuracion CORS 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Configuración de conexión a MySQL
def get_connection():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="",
        database="tickets_db",  
        cursorclass=pymysql.cursors.DictCursor
    )

# Modelos para funciones
class TicketCreate(BaseModel):
    title: str  
    description: str 
    priority: Optional[str] = "medium"
    tags: Optional[List[str]] = []

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 3 or len(v.strip()) > 80:
            raise ValueError('Title must be between 3 and 80 characters')
        return v.strip()

    @validator('description')
    def validate_description(cls, v):
        if not v or len(v.strip()) > 2000:
            raise ValueError('Description must not exceed 2000 characters')
        return v.strip()

    @validator('priority')
    def validate_priority(cls, v):
        if v not in ['low', 'medium', 'high']:
            raise ValueError('Priority must be low, medium, or high')
        return v

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None

    @validator('title')
    def validate_title(cls, v):
        if v is not None and (len(v.strip()) < 3 or len(v.strip()) > 80):
            raise ValueError('Title must be between 3 and 80 characters')
        return v.strip() if v else v

    @validator('description')
    def validate_description(cls, v):
        if v is not None and len(v.strip()) > 2000:
            raise ValueError('Description must not exceed 2000 characters')
        return v.strip() if v else v

class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None

    @validator('status')
    def validate_status(cls, v):
        if v not in ['open', 'in_progress', 'resolved']:
            raise ValueError('Status must be open, in_progress, or resolved')
        return v

# Función auxiliar para verificar título único
def check_unique_title(title: str, exclude_id: Optional[int] = None):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            if exclude_id:
                cursor.execute("SELECT id FROM tickets WHERE LOWER(title) = LOWER(%s) AND id != %s", (title, exclude_id))
            else:
                cursor.execute("SELECT id FROM tickets WHERE LOWER(title) = LOWER(%s)", (title,))
            return cursor.fetchone() is None
    finally:
        conn.close()

# GET /tickets - Lista con filtros, búsqueda, orden y paginación
@app.get("/tickets")
async def get_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    order_by: Optional[str] = Query("created_at"),
    order_dir: Optional[str] = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100)
):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Query base
            query = "SELECT * FROM tickets WHERE 1=1"
            params = []

            # Filtros
            if status:
                query += " AND status = %s"
                params.append(status)
            
            if priority:
                query += " AND priority = %s"
                params.append(priority)
            
            if search:
                query += " AND (title LIKE %s OR description LIKE %s)"
                search_param = f"%{search}%"
                params.extend([search_param, search_param])

            # Orden
            valid_order_fields = ['created_at', 'updated_at', 'title', 'priority', 'status']
            if order_by not in valid_order_fields:
                order_by = 'created_at'
            
            order_direction = 'ASC' if order_dir.lower() == 'asc' else 'DESC'
            query += f" ORDER BY {order_by} {order_direction}"

            # Paginación
            offset = (page - 1) * limit
            query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])

            cursor.execute(query, params)
            tickets = cursor.fetchall()

            # Cuenta total para paginación
            count_query = "SELECT COUNT(*) as total FROM tickets WHERE 1=1"
            count_params = []
            
            if status:
                count_query += " AND status = %s"
                count_params.append(status)
            if priority:
                count_query += " AND priority = %s"
                count_params.append(priority)
            if search:
                count_query += " AND (title LIKE %s OR description LIKE %s)"
                search_param = f"%{search}%"
                count_params.extend([search_param, search_param])

            cursor.execute(count_query, count_params)
            total = cursor.fetchone()['total']

            # Procesa tags JSON
            for ticket in tickets:
                if ticket['tags']:
                    try:
                        ticket['tags'] = json.loads(ticket['tags']) if isinstance(ticket['tags'], str) else ticket['tags']
                    except:
                        ticket['tags'] = []
                else:
                    ticket['tags'] = []

            return {
                "tickets": tickets,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": (total + limit - 1) // limit
                }
            }
    finally:
        conn.close()

#Crea nuevo ticket
@app.post("/tickets")
async def create_ticket(ticket: TicketCreate):
    # Verifica título único
    if not check_unique_title(ticket.title):
        raise HTTPException(status_code=400, detail="Title must be unique")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            now = datetime.now().date()
            cursor.execute("""
                INSERT INTO tickets (title, description, status, priority, tags, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                ticket.title,
                ticket.description,
                "open",
                ticket.priority,
                json.dumps(ticket.tags),
                now,
                now
            ))
            ticket_id = cursor.lastrowid
            conn.commit()

            # Obtiene el ticket creado
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            created_ticket = cursor.fetchone()
            if created_ticket['tags']:
                created_ticket['tags'] = json.loads(created_ticket['tags'])
            
            return created_ticket
    finally:
        conn.close()

#Actualiza el ticket completo
@app.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, ticket: TicketUpdate):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verifica que existe
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Ticket not found")

            # Verifica el título único si se está cambiando
            if ticket.title and ticket.title != existing['title']:
                if not check_unique_title(ticket.title, ticket_id):
                    raise HTTPException(status_code=400, detail="Title must be unique")

            # Prepara los campos para actualizar
            update_fields = []
            params = []

            if ticket.title is not None:
                update_fields.append("title = %s")
                params.append(ticket.title)
            
            if ticket.description is not None:
                update_fields.append("description = %s")
                params.append(ticket.description)
            
            if ticket.priority is not None:
                update_fields.append("priority = %s")
                params.append(ticket.priority)
            
            if ticket.tags is not None:
                update_fields.append("tags = %s")
                params.append(json.dumps(ticket.tags))

            if update_fields:
                update_fields.append("updated_at = %s")
                params.append(datetime.now().date())
                params.append(ticket_id)

                query = f"UPDATE tickets SET {', '.join(update_fields)} WHERE id = %s"
                cursor.execute(query, params)
                conn.commit()

            # Obtiene ticket actualizado
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            updated_ticket = cursor.fetchone()
            if updated_ticket['tags']:
                updated_ticket['tags'] = json.loads(updated_ticket['tags'])
            
            return updated_ticket
    finally:
        conn.close()

#Cambia estado
@app.patch("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: int, status_update: StatusUpdate):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verifica que existe
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Ticket not found")

            current_status = existing['status']
            new_status = status_update.status

            # Reglas de negocio
            if new_status == 'resolved':
                # Al pasar a resolved, descripción debe tener al menos 10 caracteres
                if len(existing['description']) < 10:
                    raise HTTPException(status_code=400, detail="Description must have at least 10 characters to resolve")
                
                # Actualiza resolved_at
                cursor.execute("""
                    UPDATE tickets SET status = %s, resolved_at = %s, updated_at = %s 
                    WHERE id = %s
                """, (new_status, datetime.now().date(), datetime.now().date(), ticket_id))
            
            elif current_status == 'resolved' and new_status != 'resolved':
                # No se puede regresar de resolved sin reason
                if not status_update.reason or len(status_update.reason.strip()) < 3:
                    raise HTTPException(status_code=400, detail="Reason is required to change from resolved status")
                
                # Actualiza y limpia resolved_at
                cursor.execute("""
                    UPDATE tickets SET status = %s, resolved_at = NULL, updated_at = %s 
                    WHERE id = %s
                """, (new_status, datetime.now().date(), ticket_id))
            
            else:
                # Cambio normal de estado
                cursor.execute("""
                    UPDATE tickets SET status = %s, updated_at = %s 
                    WHERE id = %s
                """, (new_status, datetime.now().date(), ticket_id))

            conn.commit()

            # Obtiene ticket actualizado
            cursor.execute("SELECT * FROM tickets WHERE id = %s", (ticket_id,))
            updated_ticket = cursor.fetchone()
            if updated_ticket['tags']:
                updated_ticket['tags'] = json.loads(updated_ticket['tags'])
            
            return updated_ticket
    finally:
        conn.close()

#Elimina los ticket
@app.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            # Verifica que existe y obtiene estado
            cursor.execute("SELECT status FROM tickets WHERE id = %s", (ticket_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            # No se pueden borrar tickets en in_progress
            if result['status'] == 'in_progress':
                raise HTTPException(status_code=400, detail="Cannot delete tickets in progress")

            cursor.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
            conn.commit()
            
            return {"message": "Ticket deleted successfully"}
    finally:
        conn.close()

# Endpoint adicional para obtener estadísticas
@app.get("/tickets/stats")
async def get_ticket_stats():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    status,
                    COUNT(*) as count
                FROM tickets 
                GROUP BY status
            """)
            stats = cursor.fetchall()
            
            result = {"open": 0, "in_progress": 0, "resolved": 0}
            for stat in stats:
                result[stat['status']] = stat['count']
            
            return result
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)