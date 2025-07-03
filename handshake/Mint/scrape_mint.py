from app_store_scraper import AppStore
import pandas as pd
import numpy as np

# Example for Mint app (replace with actual app_name and app_id)
mint = AppStore(country="us", app_name="YNAB", app_id="1010865877")

# Scrape up to 1500 reviews
mint.review(how_many=1500)

# Convert reviews to DataFrame
df = pd.DataFrame(np.array(mint.reviews), columns=['review'])
df2 = df.join(pd.DataFrame(df.pop('review').tolist()))

# Save to CSV for analysis
df2.to_csv('mint_reviews.csv', index=False)
