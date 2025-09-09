 // DOM Elements
        const taskInput = document.getElementById('task-input');
        const deadlineInput = document.getElementById('deadline-input');
        const addTaskBtn = document.getElementById('add-task-btn');
        const searchInput = document.getElementById('search-input');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const taskList = document.getElementById('task-list');
        const prevPageBtn = document.getElementById('prev-page-btn');
        const nextPageBtn = document.getElementById('next-page-btn');
        const pageInfo = document.getElementById('page-info');
        const exportJsonBtn = document.getElementById('export-json-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        const themeToggle = document.querySelector('.theme-toggle');

        // State management
        let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        let currentFilter = 'all';
        let currentSearch = '';
        let currentPage = 1;
        const tasksPerPage = 5;
        let recentlyDeletedTask = null;
        let undoTimeout = null;

        // Theme management
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';

        // Initialize the app
        function init() {
            renderTasks();
            setupEventListeners();
            checkNotificationPermission();
            startFilterRotation();
        }

        // Set up event listeners
        function setupEventListeners() {
            addTaskBtn.addEventListener('click', addTask);
            taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTask();
            });
            
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value.toLowerCase();
                currentPage = 1;
                renderTasks();
            });
            
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    currentSearch = '';
                    renderTasks();
                }
            });
            
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.dataset.filter;
                    currentPage = 1;
                    renderTasks();
                });
            });
            
            prevPageBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTasks();
                }
            });
            
            nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(getFilteredTasks().length / tasksPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    renderTasks();
                }
            });
            
            exportJsonBtn.addEventListener('click', exportToJson);
            exportCsvBtn.addEventListener('click', exportToCsv);
            
            themeToggle.addEventListener('click', toggleTheme);
        }

        // Add a new task
        function addTask() {
            const text = taskInput.value.trim();
            if (!text) return;
            
            const newTask = {
                id: Date.now(),
                text: text,
                completed: false,
                deadline: deadlineInput.value || null,
                createdAt: new Date().toISOString()
            };
            
            tasks.unshift(newTask);
            saveTasks();
            renderTasks();
            
            // Reset input fields
            taskInput.value = '';
            deadlineInput.value = '';
            taskInput.focus();
            
            // Check for deadline notification
            checkDeadlineNotification(newTask);
        }

        // Toggle task completion
        function toggleTaskCompletion(id) {
            tasks = tasks.map(task => {
                if (task.id === id) {
                    return { ...task, completed: !task.completed };
                }
                return task;
            });
            saveTasks();
            renderTasks();
        }

        // Edit task text
        function editTask(id, newText) {
            if (!newText.trim()) return;
            
            tasks = tasks.map(task => {
                if (task.id === id) {
                    return { ...task, text: newText.trim() };
                }
                return task;
            });
            saveTasks();
            renderTasks();
        }

        // Delete task with animation and undo option
        function deleteTask(id, showUndo = true) {
            const taskIndex = tasks.findIndex(task => task.id === id);
            if (taskIndex === -1) return;
            
            // Store the deleted task for potential undo
            recentlyDeletedTask = tasks[taskIndex];
            
            // Animate the task removal
            const taskElement = document.querySelector(`[data-task-id="${id}"]`);
            if (taskElement) {
                taskElement.classList.add('removing');
                
                setTimeout(() => {
                    tasks = tasks.filter(task => task.id !== id);
                    saveTasks();
                    renderTasks();
                    
                    // Show undo notification if requested
                    if (showUndo) {
                        showUndoNotification();
                    }
                }, 300);
            } else {
                tasks = tasks.filter(task => task.id !== id);
                saveTasks();
                renderTasks();
                
                // Show undo notification if requested
                if (showUndo) {
                    showUndoNotification();
                }
            }
        }

        // Show undo notification
        function showUndoNotification() {
            // Remove any existing notification
            const existingNotification = document.querySelector('.undo-notification');
            if (existingNotification) {
                existingNotification.remove();
                clearTimeout(undoTimeout);
            }
            
            // Create new notification
            const notification = document.createElement('div');
            notification.className = 'undo-notification';
            notification.innerHTML = `
                <span>Task deleted</span>
                <button class="btn-undo" id="undo-delete-btn">Undo</button>
            `;
            
            document.body.appendChild(notification);
            
            // Add event listener to undo button
            document.getElementById('undo-delete-btn').addEventListener('click', () => {
                undoDelete();
                notification.classList.add('hiding');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            });
            
            // Set timeout to automatically remove notification
            undoTimeout = setTimeout(() => {
                notification.classList.add('hiding');
                setTimeout(() => {
                    notification.remove();
                    recentlyDeletedTask = null;
                }, 300);
            }, 5000);
        }

        // Undo the last delete operation
        function undoDelete() {
            if (recentlyDeletedTask) {
                tasks.unshift(recentlyDeletedTask);
                saveTasks();
                renderTasks();
                recentlyDeletedTask = null;
                clearTimeout(undoTimeout);
            }
        }

        // Save tasks to localStorage
        function saveTasks() {
            localStorage.setItem('tasks', JSON.stringify(tasks));
        }

        // Get filtered tasks based on current filter and search
        function getFilteredTasks() {
            return tasks.filter(task => {
                const matchesSearch = task.text.toLowerCase().includes(currentSearch);
                let matchesFilter = true;
                
                if (currentFilter === 'completed') {
                    matchesFilter = task.completed;
                } else if (currentFilter === 'pending') {
                    matchesFilter = !task.completed;
                }
                
                return matchesSearch && matchesFilter;
            });
        }

        // Render tasks to the DOM
        function renderTasks() {
            const filteredTasks = getFilteredTasks();
            const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
            
            // Handle pagination
            if (currentPage > totalPages && totalPages > 0) {
                currentPage = totalPages;
            }
            
            const startIndex = (currentPage - 1) * tasksPerPage;
            const paginatedTasks = filteredTasks.slice(startIndex, startIndex + tasksPerPage);
            
            // Clear task list
            taskList.innerHTML = '';
            
            // Display empty state if no tasks
            if (paginatedTasks.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.textContent = currentSearch ? 'No tasks found for your search.' : 'No tasks yet. Add one above!';
                taskList.appendChild(emptyState);
            } else {
                // Render tasks
                paginatedTasks.forEach(task => {
                    const taskElement = createTaskElement(task);
                    taskList.appendChild(taskElement);
                });
            }
            
            // Update pagination controls
            updatePaginationControls(filteredTasks.length, totalPages);
        }

        // Create DOM element for a task
        function createTaskElement(task) {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            taskElement.setAttribute('data-task-id', task.id);
            
            // Add overdue class if task is overdue
            if (isOverdue(task) && !task.completed) {
                taskElement.classList.add('overdue');
            }
            
            const taskContent = document.createElement('div');
            taskContent.className = 'task-content';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'task-checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => toggleTaskCompletion(task.id));
            
            const taskText = document.createElement('div');
            taskText.className = `task-text ${task.completed ? 'completed' : ''}`;
            taskText.textContent = task.text;
            
            const deadline = document.createElement('div');
            deadline.className = 'task-deadline';
            deadline.textContent = getDeadlineText(task);
            
            const taskActions = document.createElement('div');
            taskActions.className = 'task-actions';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.className = 'btn-edit';
            editBtn.addEventListener('click', () => {
                const newText = prompt('Edit your task:', task.text);
                if (newText !== null) { // User didn't cancel
                    editTask(task.id, newText);
                }
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'btn-delete';
            deleteBtn.addEventListener('click', () => {
                deleteTask(task.id);
            });
            
            taskContent.appendChild(checkbox);
            taskContent.appendChild(taskText);
            taskContent.appendChild(deadline);
            
            taskActions.appendChild(editBtn);
            taskActions.appendChild(deleteBtn);
            
            taskElement.appendChild(taskContent);
            taskElement.appendChild(taskActions);
            
            return taskElement;
        }

        // Get deadline text for display
        function getDeadlineText(task) {
            if (!task.deadline) return '';
            
            const deadlineDate = new Date(task.deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const diffTime = deadlineDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Due today';
            if (diffDays === 1) return 'Due tomorrow';
            if (diffDays > 1) return `${diffDays} days left`;
            if (diffDays === -1) return 'Overdue by 1 day';
            return `Overdue by ${Math.abs(diffDays)} days`;
        }

        // Check if a task is overdue
        function isOverdue(task) {
            if (!task.deadline || task.completed) return false;
            
            const deadlineDate = new Date(task.deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            return deadlineDate.getTime() < today.getTime();
        }

        // Update pagination controls
        function updatePaginationControls(totalTasks, totalPages) {
            // Update page info
            pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
            
            // Enable/disable navigation buttons
            prevPageBtn.disabled = currentPage <= 1;
            nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
        }

        // Export tasks to JSON
        function exportToJson() {
            const dataStr = JSON.stringify(tasks, null, 2);
            const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
            
            const exportFileDefaultName = `tasks-${new Date().toISOString().slice(0, 10)}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        }

        // Export tasks to CSV
        function exportToCsv() {
            const headers = ['ID', 'Text', 'Completed', 'Deadline', 'Created At'];
            const csvData = tasks.map(task => [
                task.id,
                `"${task.text.replace(/"/g, '""')}"`,
                task.completed ? 'Yes' : 'No',
                task.deadline || 'None',
                task.createdAt
            ]);
            
            const csvContent = [headers, ...csvData]
                .map(row => row.join(','))
                .join('\n');
            
            const dataUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
            const exportFileDefaultName = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        }

        // Toggle theme
        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
        }

        // Check for notification permission
        function checkNotificationPermission() {
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        // Check if a task needs a deadline notification
        function checkDeadlineNotification(task) {
            if (!task.deadline || !('Notification' in window) || Notification.permission !== 'granted') {
                return;
            }
            
            const deadlineDate = new Date(task.deadline);
            const today = new Date();
            const timeDiff = deadlineDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff <= 1) {
                new Notification('Task Deadline', {
                    body: `Task "${task.text}" is due ${daysDiff === 0 ? 'today' : 'tomorrow'}.`,
                    icon: '/favicon.ico'
                });
            }
        }

        // Auto-rotate filters every 10 seconds (optional feature)
        function startFilterRotation() {
            setInterval(() => {
                const filters = ['all', 'completed', 'pending'];
                const currentIndex = filters.indexOf(currentFilter);
                const nextIndex = (currentIndex + 1) % filters.length;
                
                filterBtns.forEach(btn => btn.classList.remove('active'));
                filterBtns[nextIndex].classList.add('active');
                
                currentFilter = filters[nextIndex];
                renderTasks();
            }, 10000);
        }

        // Initialize the app
        init();