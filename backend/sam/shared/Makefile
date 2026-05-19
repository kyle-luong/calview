# Ensures calview_shared is in the layer zip (SAM python3.12 build omits local modules).
build-SharedLayer:
	mkdir -p "$(ARTIFACTS_DIR)/python/calview_shared"
	cp -r python/calview_shared/. "$(ARTIFACTS_DIR)/python/calview_shared/"
	python3 -m pip install -r requirements.txt -t "$(ARTIFACTS_DIR)/python/lib/python3.12/site-packages" --upgrade --quiet
