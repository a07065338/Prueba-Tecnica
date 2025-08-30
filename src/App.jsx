import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:8000'

function App() {
  // Estados principales
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({ open: 0, in_progress: 0, resolved: 0 })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  // Estados para filtros y búsqueda
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
    order_by: 'created_at',
    order_dir: 'desc'
  })
  
  // Estados para formularios
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [statusChange, setStatusChange] = useState({ ticketId: null, reason: '' })
  
  // Estado del formulario de creación/edición
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    tags: ''
  })

  // Función para hacer peticiones HTTP
  const apiCall = async (url, options = {}) => {
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    }
    
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }
    
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Error desconocido' }))
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  // Función para mostrar mensajes temporales
  const showMessage = (msg, type = 'info') => {
    setMessage({ text: msg, type })
    setTimeout(() => setMessage(''), 3000)
  }

  // GET tickets con filtros
  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.search) params.append('search', filters.search)
      params.append('order_by', filters.order_by)
      params.append('order_dir', filters.order_dir)

      const data = await apiCall(`${API_URL}/tickets?${params}`)
      setTickets(data.tickets || data)
    } catch (err) {
      showMessage('Error al obtener tickets: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // GET estadísticas
  const fetchStats = async () => {
    try {
      const data = await apiCall(`${API_URL}/tickets/stats`)
      setStats(data)
    } catch (err) {
      console.error('Error al obtener estadísticas:', err)
    }
  }

  // POST - Crear ticket
  const createTicket = async (e) => {
    e.preventDefault()
    try {
      const ticketData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      }

      await apiCall(`${API_URL}/tickets`, {
        method: 'POST',
        body: ticketData
      })

      showMessage('Ticket creado exitosamente', 'success')
      setShowCreateForm(false)
      setFormData({ title: '', description: '', priority: 'medium', tags: '' })
      fetchTickets()
      fetchStats()
    } catch (err) {
      showMessage('Error al crear ticket: ' + err.message, 'error')
    }
  }

  // PUT - Actualizar ticket
  const updateTicket = async (e) => {
    e.preventDefault()
    try {
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      }

      await apiCall(`${API_URL}/tickets/${editingTicket.id}`, {
        method: 'PUT',
        body: updateData
      })

      showMessage('Ticket actualizado exitosamente', 'success')
      setEditingTicket(null)
      setFormData({ title: '', description: '', priority: 'medium', tags: '' })
      fetchTickets()
    } catch (err) {
      showMessage('Error al actualizar ticket: ' + err.message, 'error')
    }
  }

  // PATCH - Cambiar estado
  const changeStatus = async (ticketId, newStatus, reason = '') => {
    try {
      const statusData = { status: newStatus }
      if (reason) statusData.reason = reason

      await apiCall(`${API_URL}/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: statusData
      })

      showMessage(`Estado cambiado a ${newStatus}`, 'success')
      setStatusChange({ ticketId: null, reason: '' })
      fetchTickets()
      fetchStats()
    } catch (err) {
      showMessage('Error al cambiar estado: ' + err.message, 'error')
    }
  }

  // DELETE - Eliminar ticket
  const deleteTicket = async (ticketId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este ticket?')) return

    try {
      await apiCall(`${API_URL}/tickets/${ticketId}`, {
        method: 'DELETE'
      })
      showMessage('Ticket eliminado exitosamente', 'success')
      fetchTickets()
      fetchStats()
    } catch (err) {
      showMessage('Error al eliminar ticket: ' + err.message, 'error')
    }
  }

  // Iniciar edición
  const startEdit = (ticket) => {
    setEditingTicket(ticket)
    setFormData({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      tags: Array.isArray(ticket.tags) ? ticket.tags.join(', ') : ''
    })
    setShowCreateForm(false)
  }

  // Cancelar edición
  const cancelEdit = () => {
    setEditingTicket(null)
    setFormData({ title: '', description: '', priority: 'medium', tags: '' })
  }

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES')
  }

  // Cargar datos iniciales
  useEffect(() => {
    fetchTickets()
    fetchStats()
  }, [])

  // Recargar cuando cambien los filtros
  useEffect(() => {
    fetchTickets()
  }, [filters])

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>🎫 Issue Tracker</h1>

      {/* Mensaje de estado */}
      {message && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          borderRadius: '4px',
          backgroundColor: message.type === 'error' ? '#ffe6e6' : message.type === 'success' ? '#e6ffe6' : '#e6f3ff',
          color: message.type === 'error' ? '#d00' : message.type === 'success' ? '#080' : '#006',
          border: `1px solid ${message.type === 'error' ? '#d00' : message.type === 'success' ? '#080' : '#006'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Badges con estadísticas */}
      <div style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
        <span style={{ padding: '5px 10px', backgroundColor: '#007bff', color: 'white', borderRadius: '15px' }}>
          Open: {stats.open}
        </span>
        <span style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: 'black', borderRadius: '15px' }}>
          In Progress: {stats.in_progress}
        </span>
        <span style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', borderRadius: '15px' }}>
          Resolved: {stats.resolved}
        </span>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{ 
 
        padding: '15px', 
        borderRadius: '8px', 
        margin: '20px 0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center'
      }}>
        <h3 style={{ width: '100%', margin: '0 0 10px 0' }}>Filtros y Búsqueda</h3>
        
        <input
          type="text"
          placeholder="Buscar por título o descripción..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '200px' }}
        />

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">Todos los estados</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">Todas las prioridades</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <select
          value={`${filters.order_by}-${filters.order_dir}`}
          onChange={(e) => {
            const [order_by, order_dir] = e.target.value.split('-')
            setFilters({ ...filters, order_by, order_dir })
          }}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="created_at-desc">Más recientes</option>
          <option value="created_at-asc">Más antiguos</option>
          <option value="title-asc">Título A-Z</option>
          <option value="title-desc">Título Z-A</option>
          <option value="priority-desc">Prioridad alta primero</option>
          <option value="priority-asc">Prioridad baja primero</option>
        </select>

        <button
          onClick={() => setFilters({ status: '', priority: '', search: '', order_by: 'created_at', order_dir: 'desc' })}
          style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Limpiar filtros
        </button>
      </div>

      {/* Botón para crear ticket */}
      <button
        onClick={() => {
          setShowCreateForm(!showCreateForm)
          setEditingTicket(null)
          setFormData({ title: '', description: '', priority: 'medium', tags: '' })
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          margin: '10px 0'
        }}
      >
        {showCreateForm ? 'Cancelar' : '+ Crear Nuevo Ticket'}
      </button>

      {/* Formulario de creación/edición */}
      {(showCreateForm || editingTicket) && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          margin: '20px 0'
        }}>
          <h3>{editingTicket ? 'Editar Ticket' : 'Crear Nuevo Ticket'}</h3>
          <div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Título (3-80 caracteres):</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={80}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Descripción (máx. 2000 caracteres):</label>
              <textarea
                required
                maxLength={2000}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
              />
              <small style={{ color: '#666' }}>{formData.description.length}/2000 caracteres</small>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Prioridad:</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Tags (separados por comas):</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="ui, backend, bug"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={editingTicket ? updateTicket : createTicket}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingTicket ? 'Actualizar' : 'Crear'} Ticket
              </button>
              
              {editingTicket && (
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para cambio de estado con razón */}
      {statusChange.ticketId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '400px'
          }}>
            <h3>Cambio de estado desde "Resolved"</h3>
            <p>Se requiere una razón para cambiar desde el estado resolved:</p>
            <textarea
              value={statusChange.reason}
              onChange={(e) => setStatusChange({ ...statusChange, reason: e.target.value })}
              placeholder="Ingresa la razón del cambio..."
              rows={3}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => {
                  if (statusChange.reason.trim().length >= 3) {
                    changeStatus(statusChange.ticketId, statusChange.newStatus, statusChange.reason)
                  } else {
                    showMessage('La razón debe tener al menos 3 caracteres', 'error')
                  }
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setStatusChange({ ticketId: null, reason: '' })}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de tickets */}
      <div>
        <h2>Listado de Tickets {loading && '(Cargando...)'}</h2>
        
        {tickets.length === 0 && !loading ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            No se encontraron tickets con los filtros aplicados
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>{ticket.title}</h4>
                    <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                      ID: {ticket.id} | Creado: {formatDate(ticket.created_at)}
                      {ticket.resolved_at && ` | Resuelto: ${formatDate(ticket.resolved_at)}`}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Badge de estado */}
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: 
                        ticket.status === 'open' ? '#007bff' :
                        ticket.status === 'in_progress' ? '#ffc107' : '#28a745',
                      color: ticket.status === 'in_progress' ? 'black' : 'white'
                    }}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </span>

                    {/* Badge de prioridad */}
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: 
                        ticket.priority === 'high' ? '#dc3545' :
                        ticket.priority === 'medium' ? '#fd7e14' : '#6c757d',
                      color: 'white'
                    }}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p style={{ margin: '10px 0', color: '#555' }}>{ticket.description}</p>

                {/* Tags */}
                {ticket.tags && ticket.tags.length > 0 && (
                  <div style={{ margin: '10px 0' }}>
                    {ticket.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          margin: '2px',
                          backgroundColor: '#e9ecef',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#495057'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                  {/* Cambiar estado */}
                  {ticket.status !== 'resolved' && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          changeStatus(ticket.id, e.target.value)
                          e.target.value = ''
                        }
                      }}
                      style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
                    >
                      <option value="">Cambiar estado</option>
                      {ticket.status !== 'open' && <option value="open">→ Open</option>}
                      {ticket.status !== 'in_progress' && <option value="in_progress">→ In Progress</option>}
                      {ticket.description.length >= 10 && <option value="resolved">→ Resolved</option>}
                    </select>
                  )}

                  {/* Revertir desde resolved */}
                  {ticket.status === 'resolved' && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setStatusChange({ ticketId: ticket.id, newStatus: e.target.value, reason: '' })
                          e.target.value = ''
                        }
                      }}
                      style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
                    >
                      <option value="">Revertir estado</option>
                      <option value="open">→ Open (requiere razón)</option>
                      <option value="in_progress">→ In Progress (requiere razón)</option>
                    </select>
                  )}

                  <button
                    onClick={() => startEdit(ticket)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => deleteTicket(ticket.id)}
                    disabled={ticket.status === 'in_progress'}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: ticket.status === 'in_progress' ? '#ccc' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: ticket.status === 'in_progress' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
