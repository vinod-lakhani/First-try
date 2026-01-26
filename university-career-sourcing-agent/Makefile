.PHONY: install queries run clean help

help:
	@echo "University Career Contacts Sourcing Agent - Makefile"
	@echo ""
	@echo "Available commands:"
	@echo "  make install     - Install Python dependencies"
	@echo "  make queries     - Generate query packs for all schools"
	@echo "  make run         - Run the agent with sample data"
	@echo "  make clean       - Remove outputs directory"
	@echo "  make help        - Show this help message"

install:
	pip install -r requirements.txt

queries:
	python src/agent.py queries --config schools.json

run:
	python src/agent.py run --input sample_input_contacts.csv --config schools.json --staff staff_pages.json --offer "WeLeap career planning tool"

clean:
	rm -rf outputs/
